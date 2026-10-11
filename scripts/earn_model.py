"""Phase E (admin 4847, Q12): Monte Carlo of English Spell earn rates, mirroring the live backend rules (catalog.py, play.py, engage.py, season).
profiles: stages per active day, active days per week, accuracy, league rank band. 52 simulated weeks x 200 players."""
import random, statistics as S
STAGE_MIX = ['lesson','practice','practice2','trial']*3   # 12 required, then boss + vault (+ gate world sometimes)
QC = {'lesson':8,'practice':10,'practice2':6,'trial':12,'boss':15,'bonus':10}
DAILY = [('win',[2,3],120,'c'),('three',[1,2],150,'c'),('correct',[20,30],0,'e'),('xp',[150,250],100,'c'),
         ('variety',[2,3],110,'c'),('stars',[5,8],130,'c'),('cauldron',[10,15],120,'c')]
WEEKLY = [('wwin',[12,15],10),('wthree',[6,8],15),('wcorrect',[120,160],0),('wboss',[1],15),('wxp',[1200,1600],8)]
LEAGUE = {'none':(0,0),'top10':(3,0),'top3':(15,550)}   # gems, chest coins (silver avg 550 + .6 elixir)
def stars_for(a): return 3 if a>=.9 else 2 if a>=.75 else 1 if a>=.5 else 0
def sim(spd, days, acc, league, goal, weeks=52, seed=1, wk_bonus=None, events=False, rush=0, comp=None):
    r = random.Random(seed); g=c=0; lvl_xp=0; need=800; seq=0; season_xp=0; season_month_xp=[]
    out=[]
    for w in range(weeks):
        wg=wc=0; wk={'stages_won':0,'stars3':0,'correct':0,'xp':0,'bosses':0}; dall=0
        act = sorted(r.sample(range(7), days))
        for d in range(7):
            if d not in act: continue
            t={'stages_won':0,'stars3':0,'correct':0,'xp':0,'stars':0,'games':0,'review':0}; sx=0
            for s in range(spd):
                k = (STAGE_MIX+['boss','bonus'])[seq%14]; seq+=1
                n=QC[k]; cor=sum(r.random()<acc for _ in range(n)); st=stars_for(cor/n)
                coins=cor*5+st*15; xp=cor*12+st*10
                if events and d==2: xp*=2
                if k=='bonus' and st>0: wg+=10; comp['treasure']+=10
                wc+=coins; t['correct']+=cor; t['xp']+=xp; t['stars']+=st; t['games']+=1
                if st>0: t['stages_won']+=1
                if st==3: t['stars3']+=1
                if k=='boss' and st>0: wk['bosses']+=1
                lvl_xp+=xp
                while lvl_xp>=need: lvl_xp-=need; need=round(need*1.15); wg+=5; comp['level']+=5
                sx += (20+10*st if st>0 else 5)*(2 if events and d==2 else 1)
            if events and d>=5:
                used=0
                for _ in range(rush):
                    n=15; cor=sum(r.random()<acc for _ in range(n)); st=stars_for(cor/n); wc+=(cor*5+st*15)//2
                    if st>0 and used<2: gg=5+(3 if st==3 else 0); wg+=gg; comp['rush']+=gg; used+=1
            t['review']=r.randint(0,12)
            quests=r.Random(f'{w}-{d}').sample(DAILY,3) if False else random.Random(f'{w}-{d}').sample(DAILY,3)
            done=0
            for q,ns,rc,_ in quests:
                n = goal if q=='win' else random.Random(f'{w}{d}{q}').choice(ns)
                v={'win':t['stages_won'],'three':t['stars3'],'correct':t['correct'],'xp':t['xp'],'variety':min(t['games'],3),
                   'stars':t['stars'],'cauldron':t['review']}[q]
                if v>=n: done+=1; wc+=rc; sx+=25
            if done==3: wg+=2; wc+=115; dall+=1; comp['daily_all']+=2
            season_xp += min(sx,600)
            for k2 in wk:
                if k2 in t: wk[k2]+=t[k2]
        for q,ns,gr in random.Random(f'w{w}').sample(WEEKLY,3):
            n=random.Random(f'w{w}{q}').choice(ns)
            v={'wwin':wk['stages_won'],'wthree':wk['stars3'],'wcorrect':wk['correct'],'wboss':wk['bosses'],'wxp':wk['xp']}[q]
            if v>=n: wg+=gr; comp['weekly']+=gr; wc+= 550 if q=='wcorrect' else 0; season_xp+=60
        if dall>=5: wc+=1300
        lg,lc=LEAGUE[league]; wg+=lg; wc+=lc; comp['league']+=lg
        if wk_bonus: a,b = wk_bonus(wk); wg+=a; wc+=b
        out.append((wg,wc,season_xp)); season_xp=0
    return out
def season_month(sxp_week):
    xp=sxp_week*30/7; tiers=min(30,int(xp//150)); g=sum(5 for n in (5,15,25) if n<=tiers)
    coins=sum(100+20*(n//5) for n in range(1,tiers+1) if n not in (5,15,25,8,18,28,10,20,12,30)) + (115 if tiers>=12 else 0)
    return tiers,g,coins
P = {'casual':(1,4,.70,'none',1),'regular':(2,6,.80,'top10',2),'serious':(5,7,.88,'top3',3)}
P = {'casual':(1,4,.70,'none',1,0),'regular':(2,6,.80,'top10',2,1),'serious':(5,7,.88,'top3',3,2)}
if __name__=='__main__':
    import collections
    for ev in (False, True):
        print('--- events' if ev else '--- no events (before Phase E)')
        for name,(spd,days,acc,lg,goal,rush) in P.items():
            comp=collections.Counter(); res=[sim(spd,days,acc,lg,goal,seed=i,events=ev,rush=rush,comp=comp) for i in range(40)]
            wk=[x for r in res for x in r]; N=len(wk)
            g=S.mean(x[0] for x in wk); c=S.mean(x[1] for x in wk); sx=S.mean(x[2] for x in wk)
            tiers,sg,scn=season_month(sx)
            parts=' '.join(f"{k}={v/N:.1f}" for k,v in sorted(comp.items()))
            print(f"{name:8} gems/wk {g+sg*7/30:5.1f} coins/wk {c+scn*7/30:6.0f} | season tiers/mo {tiers} (+{sg*7/30:.1f} gems/wk) | {parts}")
