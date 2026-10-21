// English Spell wardrobe: ownership on the server (UX audit Phase B, 10-11).
// - recolour treasures (catalogue `recolour`): the base garment worn with a fixed dye. localStorage rcVariant {slot:{id,base,swatch}}
//   and rcTintFx {baseFile: swatch} (the hero page reads rcTintFx the same way), so every page shows them alike.
// - in the editor, with the app's token: locks and price chips from GET /v1/wardrobe, buy in place (confirm, server deducts,
//   then own and wear), earned items say how to get them, the look is saved on the account (PUT /v1/wardrobe/look).
(function () {
  'use strict';
  const API = '/runecast-api';
  const LSG = (k) => { try { return localStorage.getItem(k) } catch (e) { return null } };
  const LSS = (k, v) => { try { localStorage.setItem(k, v) } catch (e) { /* private mode */ } };
  const Q = new URLSearchParams(location.search);
  const EDITOR = !Q.get('embed') && !Q.get('battle') && !Q.get('portrait');
  const SLOTS = ['hair', 'haircolor', 'eyes', 'hat', 'top', 'coat', 'pants', 'shoes', 'wand'];   // wand: admin 5762
  const SN = { top: 'Top', coat: 'Outer', pants: 'Legs', shoes: 'Feet' };          // catalogue slot -> OUTFIT row
  const GARM = ['top', 'coat', 'pants', 'shoes'];
  const HC = ['natural', 'black', 'darkbrown', 'chestnut', 'auburn', 'ginger', 'blonde', 'platinum', 'pink', 'lilac', 'blue', 'mint'];

  // ---------------------------------------------------------------- recolours (all modes)
  let FX = {}, VAR = {};
  try { FX = JSON.parse(LSG('rcTintFx') || '{}') || {} } catch (e) { FX = {} }
  try { VAR = JSON.parse(LSG('rcVariant') || '{}') || {} } catch (e) { VAR = {} }
  if (typeof applyTint === 'function') {
    const a0 = applyTint;
    // eslint-disable-next-line no-global-assign
    applyTint = function (id, key) { return a0(id, FX[id] || key) };
  }
  const saveVar = () => { LSS('rcVariant', JSON.stringify(VAR)); LSS('rcTintFx', JSON.stringify(FX)) };
  const reTint = (base) => { if (typeof TINTS !== 'undefined' && TINTS[base] && window.ED) applyTint(base, ED.LOOK.tint[base] || 'original') };
  function setVariant(slot, v) {
    const old = VAR[slot];
    if (old && old.base !== v.base) { delete FX[old.base]; reTint(old.base) }
    VAR[slot] = v; FX[v.base] = v.swatch; saveVar(); reTint(v.base);
  }
  function clearVariant(slot) {
    const old = VAR[slot];
    if (!old) return;
    delete VAR[slot]; delete FX[old.base]; saveVar(); reTint(old.base);
  }

  // ---------------------------------------------------------------- state
  const S = { on: false, items: {}, dyes: new Set(), dyePrice: 150, wallet: null, base: null, pending: null, lastSaved: '', saveT: 0, busy: false };
  const ED_ = () => window.ED, UI = () => window.EDUI;
  const tok = () => LSG('es.api.token');
  async function call(method, path, body) {
    const t = tok();
    const r = await fetch(API + path, { method, headers: Object.assign({ 'content-type': 'application/json' }, t ? { authorization: 'Bearer ' + t } : {}), body: body ? JSON.stringify(body) : undefined });
    let j = null; try { j = await r.json() } catch (e) { /* empty */ }
    if (!r.ok) { const d = j && j.detail; const e = new Error((d && d.message) || 'Something went wrong'); e.code = (d && d.code) || ('http_' + r.status); throw e }
    return j;
  }
  const post = (m) => { try { parent.postMessage(m, '*') } catch (e) { /* standalone */ } };

  // ---------------------------------------------------------------- page <-> catalogue ids
  function hairId(i) {
    const E = ED_(); if (!E) return null;
    if (i in E.HAIR_RETIRED) i = E.HAIR_RETIRED[i];
    if (!E.HAIRS[i] || !E.HAIRS[i][1]) return 'hair_short';
    return (E.HAIRS[i][1].match(/(hair_[a-z]+)/) || [])[1] || 'hair_short';
  }
  function hairIdx(id) { const E = ED_(); for (let i = 0; i < E.HAIRS.length; i++) if (!(i in E.HAIR_RETIRED) && hairId(i) === id) return i; return 0 }
  const outfitOpts = (slot) => ED_().OUTFIT.find((o) => o[0] === SN[slot])[1];
  function slotItem(slot) {
    const E = ED_(), L = E.LOOK;
    if (slot === 'hair') return hairId(L.hair);
    if (slot === 'haircolor') return 'haircolor_' + (HC[L.hairColor] || 'natural');
    if (slot === 'eyes') return 'eyes_' + ((IRIS_COLORS[L.iris] || IRIS_COLORS[0])[1]);
    if (slot === 'wand') return E.wandId ? E.wandId() : 'wand_starter';
    if (slot === 'hat') return L.hat ? ((E.HATS[L.hatPick] || [])[1] || 'hat') : null;
    if (VAR[slot]) return VAR[slot].id;
    const i = L.outfit[SN[slot]];
    return (outfitOpts(slot)[i == null ? 1 : i] || [])[1] || null;
  }
  function curLook() {
    const L = ED_().LOOK;
    const o = { body: L.girl ? 'girl' : 'boy', tone: L.tone, blush: Math.round(+L.blush || 0), tint: Object.assign({}, L.tint) };
    for (const s of SLOTS) o[s] = slotItem(s);
    return o;
  }
  async function setSlot(slot, id) {
    const E = ED_();
    if (slot === 'hair') E.setHair(hairIdx(id || 'hair_short'));
    else if (slot === 'haircolor') E.pickHairColor(Math.max(0, HC.indexOf(String(id || '').replace('haircolor_', ''))));
    else if (slot === 'eyes') E.pickIris(Math.max(0, IRIS_COLORS.findIndex((c) => 'eyes_' + c[1] === id)));
    else if (slot === 'wand') { if (E.setWand) E.setWand(id || 'wand_starter') }
    else if (slot === 'hat') { if (!id) E.setHat(false); else E.pickHat(Math.max(0, E.HATS.findIndex((h) => (h[1] || 'hat') === id))) }
    else {
      const opts = outfitOpts(slot), it = S.items[id];
      if (it && it.recolour) {
        setVariant(slot, { id, base: it.recolour.base, swatch: it.recolour.swatch });
        await E.wear(SN[slot], Math.max(0, opts.findIndex((x) => x[1] === it.recolour.base)));
        reTint(it.recolour.base);
      } else {
        clearVariant(slot);
        await E.wear(SN[slot], id ? Math.max(0, opts.findIndex((x) => x[1] === id)) : 0);
      }
    }
  }
  async function applyLook(lk) {
    if (!lk) return;
    const E = ED_();
    if (!!E.LOOK.girl !== (lk.body === 'girl')) E.setGirl(lk.body === 'girl', false);
    if (lk.tone != null && E.LOOK.tone !== lk.tone) E.setTone(lk.tone);
    if (lk.blush != null) { E.setBlush(lk.blush); LSS('blush', lk.blush) }
    const tint = lk.tint || {};
    for (const k of Object.keys(E.LOOK.tint)) if (!(k in tint)) E.setTint(k, 'original');
    for (const [k, v] of Object.entries(tint)) if (E.LOOK.tint[k] !== v) E.setTint(k, v);
    for (const s of SLOTS) if (slotItem(s) !== lk[s]) await setSlot(s, lk[s]);
  }

  // ---------------------------------------------------------------- ownership
  const owned = (id) => id == null || !S.on || !S.items[id] || S.items[id].owned;
  const dyeOwned = (g, sw) => !S.on || !sw || sw === 'original' || S.dyes.has(g + ':' + sw);
  const sw = (k) => (PALETTE.find((p) => p[0] === k) || [])[2] || '#999';
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const COIN = '<i class="oc-coin" aria-hidden="true"></i>', GEM = '<i class="oc-gem" aria-hidden="true"></i>';
  const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7.5a5 5 0 0 1 10 0V10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="10" width="15" height="11" rx="3" fill="currentColor"/></svg>';
  function chipHtml(it) {
    if (it.tier === 'coin') return COIN + fmt(it.price_coins);
    if (it.tier === 'gem') return GEM + fmt(it.price_gems);
    if (it.tier === 'premium') return LOCK + 'Soon';
    return LOCK + 'Earn';
  }

  // decorate a card / eye / swatch button with its lock + price chip (o.item = catalogue id; o.slot='dye' for dye swatches)
  function deco(b, o) {
    if (o.dot) { const d = document.createElement('span'); d.className = 'own-dot'; d.style.background = o.dot; (b.querySelector('.th') || b).appendChild(d) }
    if (!S.on || o.item == null) return;
    if (o.slot === 'dye') {
      if (!dyeOwned(o.garment, o.swatch)) { b.classList.add('own-lk'); const c = document.createElement('span'); c.className = 'own-sl'; c.innerHTML = LOCK; b.appendChild(c) }
      return;
    }
    const it = S.items[o.item];
    if (!it || it.owned) return;
    b.classList.add('own-lk');
    if (b.classList.contains('sw')) { const c = document.createElement('span'); c.className = 'own-sl'; c.innerHTML = LOCK; b.appendChild(c); return }
    const c = document.createElement('span'); c.className = 'own-pc own-' + it.tier; c.innerHTML = chipHtml(it);
    (b.querySelector('.th') || b.querySelector('.ir') || b).appendChild(c);
  }

  // ---------------------------------------------------------------- picking (preview a locked item, offer it)
  async function pick(o, go) {
    if (!S.on || o.item === undefined) { go(); return }
    if (o.premium) { showOffer(o); return }   // no 3D model yet: nothing to try on
    if (S.pending && (S.pending.slot !== o.slot || o.slot === 'dye')) await revertPending(true);
    if (GARM.includes(o.slot) && !o.variant) clearVariant(o.slot);
    go();
    const locked = o.slot === 'dye' ? !dyeOwned(o.garment, o.swatch) : !owned(o.item);
    if (locked) { S.pending = { slot: o.slot, o }; showOffer(o) }
    else { S.pending = null; hideOffer() }
  }
  async function revertPending(quiet) {
    const p = S.pending; if (!p) return;
    S.pending = null; hideOffer();
    if (p.slot === 'dye') ED_().setTint(p.o.garment, (S.base && S.base.tint[p.o.garment]) || 'original');
    else await setSlot(p.slot, S.base ? S.base[p.slot] : null);
    if (!quiet && UI()) UI().sync();
  }

  // ---------------------------------------------------------------- the offer card + confirm
  let offerEl = null, cfEl = null;
  function place() {
    if (!offerEl) return;
    const ed = document.getElementById('ed'); if (!ed) return;
    const r = ed.getBoundingClientRect();
    if (r.left > 40) { offerEl.style.bottom = '18px'; offerEl.style.right = (innerWidth - r.left + 18) + 'px'; offerEl.style.left = '18px' }
    else { offerEl.style.bottom = (innerHeight - r.top + 10) + 'px'; offerEl.style.left = '12px'; offerEl.style.right = '12px' }
  }
  addEventListener('resize', place);
  function itemFor(o) {
    if (o.slot === 'dye') {
      const g = S.items[o.garment];
      return { name: (g ? g.name : 'Garment') + ': ' + ((PALETTE.find((p) => p[0] === o.swatch) || [])[1] || o.swatch) + ' dye', tier: 'coin', price_coins: S.dyePrice, buyable: true, thumb: 'item_' + o.garment, dye: o };
    }
    const it = S.items[o.item] || {};
    const th = o.th || (it.recolour ? 'item_' + it.recolour.base : ('item_' + o.item));   // admin 6364: the card's own thumb first (recolours had no item_<base> picture)
    return Object.assign({}, it, { thumb: th });
  }
  function line(it) {
    if (it.tier === 'boss' || it.tier === 'earned') return it.how || 'Earn it in your journey';
    if (it.tier === 'premium') return (!it.how ? 'Premium, coming soon' : /coming soon/i.test(it.how) ? it.how : it.how + ', coming soon');   // Phase D: monthly set / season / starter
    if (it.limited && !it.buyable) return 'Wandering Merchant only, not on the cart this week';
    const have = it.tier === 'coin' ? (S.wallet ? S.wallet.coins : 0) : (S.wallet ? S.wallet.gems : 0);
    const cost = it.tier === 'coin' ? it.price_coins : it.price_gems;
    if (have < cost) return 'You need ' + fmt(cost - have) + ' more ' + (it.tier === 'coin' ? 'coins' : 'gems');
    return it.dye ? 'Dye this garment for good' : 'Try it on, then buy it';
  }
  function showOffer(o) {
    const it = itemFor(o);
    if (!offerEl) { offerEl = document.createElement('div'); offerEl.id = 'ownOffer'; offerEl.setAttribute('role', 'dialog'); document.body.appendChild(offerEl) }
    const canBuy = (it.tier === 'coin' || it.tier === 'gem') && it.buyable !== false;
    const price = it.tier === 'coin' ? COIN + fmt(it.price_coins) : GEM + fmt(it.price_gems);
    const thumb = it.dye ? '<span class="oo-sw" style="background:' + sw(it.dye.swatch) + '"></span>' : '<img src="thumbs/' + it.thumb + '.png?v=6" alt="" onerror="this.remove()">';
    const dot = it.recolour ? '<span class="own-dot" style="background:' + sw(it.recolour.swatch) + '"></span>' : '';
    offerEl.innerHTML = '<span class="oo-th">' + thumb + dot + '</span><span class="oo-main"><b></b><small></small></span>'
      + (canBuy ? '<button type="button" class="oo-buy">' + price + '</button>' : '<button type="button" class="oo-keep">Keep mine</button>')
      + '<button type="button" class="oo-x" aria-label="Close">×</button>';
    offerEl.querySelector('b').textContent = it.name || '';
    offerEl.querySelector('small').textContent = line(it);
    offerEl.className = 'show' + (canBuy ? '' : ' earn');
    const close = () => { if (o.premium) hideOffer(); else revertPending() };
    offerEl.querySelector('.oo-x').onclick = close;
    const keep = offerEl.querySelector('.oo-keep'); if (keep) keep.onclick = close;
    const buy = offerEl.querySelector('.oo-buy'); if (buy) buy.onclick = () => confirmBuy(o, it);
    place();
  }
  function hideOffer() { if (offerEl) offerEl.className = '' }
  function confirmBuy(o, it) {
    const coin = it.tier === 'coin', cost = coin ? it.price_coins : it.price_gems;
    const have = S.wallet ? (coin ? S.wallet.coins : S.wallet.gems) : 0;
    if (!cfEl) { cfEl = document.createElement('div'); cfEl.id = 'ownCf'; document.body.appendChild(cfEl) }
    cfEl.innerHTML = '<div class="cf-card" role="alertdialog" aria-modal="true"><h3></h3><p class="cf-p"></p><p class="cf-have"></p><p class="cf-err" hidden></p>'
      + '<div class="cf-acts"><button type="button" class="cf-no">Cancel</button><button type="button" class="cf-yes">' + (coin ? COIN : GEM) + fmt(cost) + '</button></div></div>';
    cfEl.querySelector('h3').textContent = (it.dye ? 'Buy ' : 'Buy ') + it.name + '?';
    cfEl.querySelector('.cf-p').textContent = it.dye ? 'The colour stays on this garment for good.' : 'It is yours for good, and you wear it now.';
    cfEl.querySelector('.cf-have').innerHTML = 'You have ' + (coin ? COIN : GEM) + fmt(have);
    const err = cfEl.querySelector('.cf-err');
    const yes = cfEl.querySelector('.cf-yes');
    if (have < cost) { yes.disabled = true; err.hidden = false; err.textContent = 'Not enough ' + (coin ? 'coins' : 'gems') + '. Earn more in quests and stages.' }
    cfEl.className = 'show';
    cfEl.querySelector('.cf-no').onclick = () => { cfEl.className = '' };
    cfEl.onclick = (e) => { if (e.target === cfEl) cfEl.className = '' };
    yes.onclick = async () => {
      if (S.busy) return; S.busy = true; yes.disabled = true;
      try {
        let r;
        if (it.dye) {
          r = await call('POST', '/v1/wardrobe/dye', { garment: it.dye.garment, swatch: it.dye.swatch });
          S.dyes = new Set(r.dyes);
        } else {
          r = await call('POST', '/v1/wardrobe/buy', { item_id: o.item });
          if (S.items[o.item]) { S.items[o.item].owned = true; S.items[o.item].buyable = false }
        }
        S.wallet = r.wallet; S.pending = null; hideOffer(); cfEl.className = '';
        post({ type: 'rc-wd-wallet', wallet: r.wallet }); post({ type: 'rc-wd-bought', item: o.item || null });
        await flush(true);
        if (UI()) UI().show(UI().cur());
      } catch (e) {
        err.hidden = false; err.textContent = e.code === 'not_enough_coins' ? 'Not enough coins.' : e.code === 'not_enough_gems' ? 'Not enough gems.' : (e.message || 'Something went wrong');
      } finally { S.busy = false; yes.disabled = false }
    };
  }

  // ---------------------------------------------------------------- saving the look on the account
  function savedLook() {
    const lk = curLook();
    const p = S.pending;
    if (p && S.base) { if (p.slot === 'dye') { if (S.base.tint[p.o.garment]) lk.tint[p.o.garment] = S.base.tint[p.o.garment]; else delete lk.tint[p.o.garment] } else lk[p.slot] = S.base[p.slot] }
    for (const s of SLOTS) if (!owned(lk[s]) && S.base) lk[s] = S.base[s];
    for (const k of Object.keys(lk.tint)) if (!dyeOwned(k, lk.tint[k])) delete lk.tint[k];
    return lk;
  }
  async function flush(force) {
    clearTimeout(S.saveT);
    if (!S.on) return;
    const lk = savedLook(); S.base = lk;
    const js = JSON.stringify(lk);
    if (!force && js === S.lastSaved) return;
    S.lastSaved = js;
    try { const r = await call('PUT', '/v1/wardrobe/look', { look: lk }); post({ type: 'rc-wd-look', look: r.look }) } catch (e) { S.lastSaved = '' }
  }
  function changed() { if (!S.on) return; clearTimeout(S.saveT); S.saveT = setTimeout(() => flush(false), 700) }

  // ---------------------------------------------------------------- surprise / reset / done
  function randomize() {
    const E = ED_(), mine = (slot) => Object.values(S.items).filter((i) => i.slot === slot && i.owned).map((i) => i.id);
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    S.pending = null; hideOffer();
    E.setGirl(Math.random() < 0.5, false); E.setTone(Math.floor(Math.random() * E.tones.length));
    const lk = { tint: {} };
    for (const s of SLOTS) { const a = mine(s); lk[s] = a.length ? rnd(a) : null }
    if (Math.random() < 0.25) lk.hat = null;
    if (Math.random() < 0.25) lk.coat = null;
    for (const k of Object.keys(E.LOOK.tint)) E.setTint(k, 'original');
    (async () => { for (const s of SLOTS) await setSlot(s, lk[s]); if (UI()) UI().sync(); changed() })();
  }
  function afterReset() { for (const s of GARM) clearVariant(s); S.pending = null; hideOffer(); changed() }
  async function beforeDone() { await revertPending(true); await flush(false) }

  // ---------------------------------------------------------------- grid extras: recolour treasures + premium cloaks
  function recolours(slot) {
    if (!S.on) return [];
    const out = [];
    for (const it of Object.values(S.items)) {
      if (it.slot !== slot) continue;
      if (it.recolour) out.push({ label: it.name, th: 'item_' + it.recolour.base, dot: sw(it.recolour.swatch), item: it.id, slot, variant: true,
        on: () => !!VAR[slot] && VAR[slot].id === it.id, pick: () => { setSlot(slot, it.id).then(() => UI() && UI().sync()) } });
      else if (it.tier === 'premium') out.push({ label: it.name, th: 'item_' + it.id, item: it.id, slot, premium: true, on: () => false, pick: () => {} });
    }
    return out;
  }

  // ---------------------------------------------------------------- start
  async function init() {
    if (!EDITOR || !tok()) return;
    try {
      let wd = await call('GET', '/v1/wardrobe');
      S.items = Object.fromEntries(wd.items.map((i) => [i.id, i])); S.dyes = new Set(wd.dyes || []); S.dyePrice = (wd.dye && wd.dye.price_coins) || 150;
      S.wallet = await call('GET', '/v1/wallet');
      await (ED_().ready || Promise.resolve());
      if (!wd.look_saved) {
        await call('PUT', '/v1/wardrobe/look', { look: curLook(), migrate: true });
        wd = await call('GET', '/v1/wardrobe');
        S.items = Object.fromEntries(wd.items.map((i) => [i.id, i])); S.dyes = new Set(wd.dyes || []);
      }
      S.on = true;
      await applyLook(wd.look);
      S.base = curLook(); S.lastSaved = JSON.stringify(S.base);
      if (UI()) UI().show(UI().cur());
    } catch (e) { S.on = false; console.warn('[wardrobe] ownership offline:', e && e.message) }
  }
  (function wait(n) { if (window.ED && window.EDUI) init(); else if (n < 600) setTimeout(() => wait(n + 1), 100) })(0);

  window.OWN = { deco, pick, changed, randomize, afterReset, beforeDone, recolours, hairId, hcId: (i) => 'haircolor_' + (HC[i] || 'natural'),
    variant: (slot) => (VAR[slot] ? VAR[slot].id : null), isVariantBase: (id) => Object.values(VAR).some((v) => v.base === id),
    on: () => S.on, state: S, curLook };

  // ---------------------------------------------------------------- styles
  const st = document.createElement('style');
  st.textContent = `
.oc-coin,.oc-gem{display:inline-block;width:12px;height:12px;margin-right:3px;vertical-align:-1px;flex:0 0 auto}
.oc-coin{border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3b8,#f5c451 45%,#c8963a);box-shadow:inset 0 0 0 1.5px #b07c22}
.oc-gem{background:linear-gradient(135deg,#d6b4ff,#8a4fd8 55%,#5a2fb0);clip-path:polygon(50% 0,100% 38%,50% 100%,0 38%)}
#ownOffer .oc-coin,#ownOffer .oc-gem{width:18px;height:18px;margin-right:4px;vertical-align:-4px;border-radius:0;box-shadow:none;clip-path:none;background:center/contain no-repeat}
#ownOffer .oc-coin{background-image:url(ui2/ic_coin.webp)}
#ownOffer .oc-gem{background-image:url(ui2/ic_gem.webp)}
.card.own-lk .th img{filter:saturate(.55) brightness(.97)}
.own-pc{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);display:flex;align-items:center;gap:1px;height:20px;padding:0 7px;border-radius:999px;
  font-size:11px;font-weight:800;line-height:1;white-space:nowrap;background:rgba(255,253,246,.96);color:#5a3a00;box-shadow:0 1px 4px rgba(60,40,120,.22);z-index:1}
.own-pc svg{width:10px;height:10px;margin-right:3px;color:#7a62b0}
.own-pc.own-gem{color:#4a2590}.own-pc.own-boss,.own-pc.own-earned{color:#7a62b0}.own-pc.own-premium{color:#a0306a}
.ecol .ir .own-pc{bottom:-8px;height:18px;padding:0 5px;font-size:10px}
.ecol.own-lk .ir{opacity:.92}
.own-sl{position:absolute;right:-4px;bottom:-4px;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:#fffdf6;color:#7a62b0;box-shadow:0 1px 3px rgba(60,40,120,.3)}
.own-sl svg{width:10px;height:10px}
.own-dot{position:absolute;right:6px;top:6px;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25);z-index:1}
#ownOffer{position:fixed;z-index:5;display:none;align-items:center;gap:10px;padding:8px 8px 8px 8px;border-radius:20px;background:rgba(255,253,246,.97);
  border:1px solid #efe4cf;box-shadow:0 10px 28px rgba(90,47,176,.22);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);max-width:520px;margin:0 auto}
#ownOffer.show{display:flex}
#ownOffer .oo-th{position:relative;flex:0 0 auto;width:52px;height:52px;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 50% 40%,#fff,#f1e9ff)}
#ownOffer .oo-th img{width:100%;height:100%;object-fit:cover}
#ownOffer .oo-th .own-dot{right:3px;top:3px}
#ownOffer .oo-sw{position:absolute;inset:9px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(60,40,120,.2)}
#ownOffer .oo-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
#ownOffer .oo-main b{font-family:var(--game);font-weight:800;font-size:15px;line-height:1.15;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#ownOffer .oo-main small{font-size:12px;font-weight:700;line-height:1.25;color:var(--ink2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#ownOffer button{flex:0 0 auto;border:0;font-family:var(--game);font-weight:800}
#ownOffer .oo-buy,#ownOffer .oo-keep{display:flex;align-items:center;height:42px;padding:0 14px;border-radius:999px;font-size:15px;color:#fff;
  background:linear-gradient(180deg,#a978ff,var(--vio2));box-shadow:0 3px 0 #5427a8,0 6px 12px rgba(90,47,176,.25)}
#ownOffer .oo-keep{background:linear-gradient(180deg,#fff6d8,#ffe7a6);color:#7a4b00;box-shadow:0 3px 0 #d9b25e}
#ownOffer .oo-buy:active,#ownOffer .oo-keep:active{transform:translateY(2px)}
#ownOffer .oo-x{width:32px;height:32px;border-radius:50%;background:#f1e9ff;color:#6f3fd0;font-size:20px;line-height:1;display:grid;place-items:center}
#ownCf{position:fixed;inset:0;z-index:9;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(42,37,80,.42)}
#ownCf.show{display:flex}
#ownCf .cf-card{width:min(340px,100%);padding:20px 18px 16px;border-radius:24px;background:var(--cream);box-shadow:0 18px 40px rgba(42,37,80,.35);text-align:center}
#ownCf h3{margin:0 0 6px;font-family:var(--game);font-weight:800;font-size:19px;line-height:1.2;color:var(--ink)}
#ownCf p{margin:0 0 6px;font-size:13.5px;font-weight:700;line-height:1.35;color:var(--ink2)}
#ownCf .cf-have{display:flex;align-items:center;justify-content:center;gap:2px;color:var(--ink)}
#ownCf .cf-err{color:#b3264a}
#ownCf .cf-acts{display:flex;gap:10px;margin-top:12px}
#ownCf .cf-acts button{flex:1 1 0;height:46px;border:0;border-radius:999px;font-family:var(--game);font-weight:800;font-size:16px;display:flex;align-items:center;justify-content:center}
#ownCf .cf-no{background:#f1e9ff;color:#5a2fb0}
#ownCf .cf-yes{color:#fff;background:linear-gradient(180deg,#a978ff,var(--vio2));box-shadow:0 3px 0 #5427a8}
#ownCf .cf-yes:disabled{opacity:.5}
`;
  document.head.appendChild(st);
})();
