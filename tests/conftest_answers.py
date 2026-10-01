"""The right answer for any pipeline item, in the shape the server's grader expects (see API.md 'Grading')."""


def correct_answer(q: dict):
    p, g = q["payload"], q["game"]
    if g == "oracle-trial":
        return p["answer"]
    if g in ("bubble-pop", "match-blitz", "memory-crystals", "boss-battle"):
        return p["back"]
    if g == "gap-gate":
        return p["front"]
    if g == "rune-order":
        return p["text"].split(" ")
    if g == "curse-breaker":
        return {"bad": p["bad"], "fix": p["fix"]}
    if g == "whisper-scroll":
        w = p["text"].split(" ")
        return [w[i] for i in p["gaps"]]
    if g == "spell-weaver":
        return p["answer"]
    if g == "rune-type":
        return p["word"]
    if g == "potion-mix":
        return p["answer"]
    if g == "echo":
        return p["text"]
    if g == "crystal-ball":
        return [x["answer"] for x in p["questions"]]
    if g == "bards-tale":
        return p["lines"]
    if g == "guild-letters":
        return p["sample"]
    if g == "tavern-talk":
        path, node = [], 0
        for _ in range(50):
            ch = p["script"][node]["choices"]
            i = next(k for k, c in enumerate(ch) if c.get("ok"))
            path.append(i)
            node = ch[i]["next"]
            if node == "end" or not isinstance(node, int):
                break
        return path
    return None
