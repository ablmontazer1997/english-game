"""Server-side answer checks per game. Returns (correct, verified). `verified=False` means the server had to trust the
client (speech games) or could not check the answer shape."""
import re

_P = re.compile(r"[^\w\s']+")


def norm(s) -> str:
    if s is None:
        return ""
    if isinstance(s, (list, tuple)):
        s = " ".join(str(x) for x in s)
    s = str(s).lower().replace("’", "'")
    s = _P.sub(" ", s)
    return " ".join(s.split())


def _eq(a, b) -> bool:
    return norm(a) == norm(b) and norm(a) != ""


SRS_GAMES = {"bubble-pop", "match-blitz", "memory-crystals", "boss-battle"}


def grade(game: str, payload: dict, answer, client_correct: bool | None) -> tuple[bool, bool]:
    p = payload or {}
    if game == "echo":
        if answer is not None and isinstance(answer, str) and answer.strip():
            # a speech-recognition transcript: accept when it matches the text after normalising
            if _eq(answer, p.get("text")):
                return True, True
        return bool(client_correct), False
    if answer is None:
        return False, True
    try:
        if game in SRS_GAMES:
            return _eq(answer, p.get("back")), True
        if game == "gap-gate":
            return (_eq(answer, p.get("front")) or _eq(answer, p.get("back"))), True
        if game == "oracle-trial":
            return _eq(answer, p.get("answer")), True
        if game == "rune-order":
            return _eq(answer, p.get("text")), True
        if game == "whisper-scroll":
            words = str(p.get("text", "")).split(" ")
            want = [words[i] for i in p.get("gaps", []) if 0 <= i < len(words)]
            got = answer if isinstance(answer, list) else str(answer).split()
            return (len(got) == len(want) and all(_eq(a, b) for a, b in zip(got, want))), True
        if game == "rune-type":
            return _eq(answer, p.get("word")), True
        if game == "potion-mix":
            return _eq(answer, p.get("answer")), True
        if game == "curse-breaker":
            if not isinstance(answer, dict):
                return False, True
            ok_bad = int(answer.get("bad", -1)) == int(p.get("bad", -2))
            fix = p.get("fix", "")
            ok_fix = norm(answer.get("fix")) == norm(fix)
            return ok_bad and ok_fix, True
        if game == "spell-weaver":
            want = p.get("answer", [])
            got = answer if isinstance(answer, list) else [answer]
            return _eq(" ".join(map(str, got)), " ".join(map(str, want))), True
        if game == "crystal-ball":
            qs = p.get("questions", [])
            got = answer if isinstance(answer, list) else []
            right = sum(1 for q, a in zip(qs, got) if _eq(a, q.get("answer")))
            return (len(qs) > 0 and right >= max(1, len(qs) - 1)), True
        if game == "bards-tale":
            lines = p.get("lines", [])
            if isinstance(answer, list) and answer and all(isinstance(x, int) for x in answer):
                return answer == list(range(len(lines))), True
            got = answer if isinstance(answer, list) else []
            return (len(got) == len(lines) and all(_eq(a, b) for a, b in zip(got, lines))), True
        if game == "guild-letters":
            text = norm(answer)
            if len(text.split()) < int(p.get("minWords", 1)):
                return False, True
            padded = f" {text} "
            for group in p.get("keys", []):
                if not any(f" {norm(k)} " in padded for k in group):
                    return False, True
            return True, True
        if game == "tavern-talk":
            script = p.get("script", [])
            got = answer if isinstance(answer, list) else []
            if not got:
                return False, True
            node = 0
            for choice_idx in got:
                if not isinstance(node, int) or node >= len(script):
                    return False, True
                choices = script[node].get("choices", [])
                if not (0 <= int(choice_idx) < len(choices)) or not choices[int(choice_idx)].get("ok"):
                    return False, True
                node = choices[int(choice_idx)].get("next")
                if node == "end":
                    return True, True
            return False, True
    except (TypeError, ValueError, KeyError, AttributeError):
        return False, True
    # unknown game: trust nothing
    return False, False
