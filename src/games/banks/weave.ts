import type { ByLevel, WeaveSpell } from './types'

// Spell Weaver: transform the source as the command says. Index 0..4 = A1..C1.
export const SPELLS: ByLevel<WeaveSpell> = [
  // A1
  [
    { source: 'You like green tea.', cmd: 'MAKE IT A QUESTION', answer: ['Do', 'you like', 'green tea?'], extra: ['Does', 'Are'] },
    { source: 'Priya is at home.', cmd: 'MAKE IT A QUESTION', answer: ['Is', 'Priya', 'at home?'], extra: ['Does', 'Do'] },
    { source: 'He plays the piano.', cmd: 'MAKE IT A QUESTION', answer: ['Does he', 'play', 'the piano?'], extra: ['plays', 'Do he'] },
    { source: 'I eat meat.', cmd: 'MAKE IT NEGATIVE', answer: ['I', 'don\'t eat', 'meat.'], extra: ['doesn\'t eat', 'not eat'] },
    { source: 'The dragon is friendly.', cmd: 'MAKE IT NEGATIVE', answer: ['The dragon', 'isn\'t', 'friendly.'], extra: ['don\'t', 'doesn\'t'] },
    { source: 'Omar works on Saturdays.', cmd: 'MAKE IT NEGATIVE', answer: ['Omar', 'doesn\'t work', 'on Saturdays.'], extra: ['doesn\'t works', 'don\'t work'] },
    { source: 'The baby is sleeping.', cmd: 'MAKE IT PLURAL', answer: ['The babies', 'are', 'sleeping.'], extra: ['babys', 'is'] },
    { source: 'This bus is late.', cmd: 'MAKE IT PLURAL', answer: ['These buses', 'are', 'late.'], extra: ['This buses', 'is'] },
    { source: 'A wizard has a hat.', cmd: 'MAKE IT PLURAL', answer: ['Wizards', 'have', 'hats.'], extra: ['has', 'hat.'] },
    { source: 'My foot is cold.', cmd: 'MAKE IT PLURAL', answer: ['My feet', 'are', 'cold.'], extra: ['foots', 'is'] },
  ],
  // A2
  [
    { source: 'We eat pizza after the match.', cmd: 'MAKE IT PAST', answer: ['We', 'ate pizza', 'after the match.'], extra: ['eated pizza', 'was ate'] },
    { source: 'Mei catches the early bus.', cmd: 'MAKE IT PAST', answer: ['Mei', 'caught', 'the early bus.'], extra: ['catched', 'was catch'] },
    { source: 'The guild meets in the tower.', cmd: 'MAKE IT PAST', answer: ['The guild', 'met', 'in the tower.'], extra: ['meeted', 'did met'] },
    { source: 'I plan to paint my room.', cmd: 'USE GOING TO', answer: ['I\'m', 'going to', 'paint my room.'], extra: ['going', 'painting'] },
    { source: 'They plan to visit Cairo in May.', cmd: 'USE GOING TO', answer: ['They', 'are going to', 'visit Cairo', 'in May.'], extra: ['is going to', 'visiting Cairo'] },
    { source: 'Look at those dark clouds. It will rain soon.', cmd: 'USE GOING TO', answer: ['It', 'is going to', 'rain soon.'], extra: ['going to', 'rains soon.'] },
    { source: 'The river is long. The canal is short.', cmd: 'COMPARE THEM', answer: ['The river', 'is longer', 'than the canal.'], extra: ['is more long', 'that the canal.'] },
    { source: 'Tea costs one coin. Coffee costs two coins.', cmd: 'COMPARE THEM', answer: ['Coffee', 'is more expensive', 'than tea.'], extra: ['is expensiver', 'then tea.'] },
    { source: 'My old job was bad. This job is worse.', cmd: 'COMPARE THEM', answer: ['This job', 'is worse', 'than my old one.'], extra: ['is badder', 'is more bad'] },
    { source: 'The potion is strong. The tea is weak.', cmd: 'COMPARE THEM', answer: ['The potion', 'is stronger', 'than the tea.'], extra: ['is more strong', 'as the tea.'] },
  ],
  // B1
  [
    { source: 'A local artist painted the mural.', cmd: 'MAKE IT PASSIVE', answer: ['The mural', 'was painted', 'by a local artist.'], extra: ['was paint', 'is painting'] },
    { source: 'They grow rice in this valley.', cmd: 'MAKE IT PASSIVE', answer: ['Rice', 'is grown', 'in this valley.'], extra: ['is growed', 'was grow'] },
    { source: 'Someone has stolen my bike.', cmd: 'MAKE IT PASSIVE', answer: ['My bike', 'has been', 'stolen.'], extra: ['has being', 'stole.'] },
    { source: '"I am tired," said Leon.', cmd: 'REPORT IT', answer: ['Leon', 'said that', 'he was tired.'], extra: ['said me', 'I am tired.'] },
    { source: '"We will call you tomorrow," they told me.', cmd: 'REPORT IT', answer: ['They told me', 'they would call me', 'the next day.'], extra: ['they will call me', 'said me'] },
    { source: '"Where do you live?" asked Zara.', cmd: 'REPORT IT', answer: ['Zara asked', 'where', 'I lived.'], extra: ['did I live.', 'do you live.'] },
    { source: 'I met a woman. She speaks five languages.', cmd: 'JOIN WITH WHO/WHICH', answer: ['I met a woman', 'who speaks', 'five languages.'], extra: ['which speaks', 'who she speaks'] },
    { source: 'This is the sword. It belonged to my grandfather.', cmd: 'JOIN WITH WHO/WHICH', answer: ['This is the sword', 'which belonged', 'to my grandfather.'], extra: ['who belonged', 'which it belonged'] },
    { source: 'The café is near the station. It sells great soup.', cmd: 'JOIN WITH WHO/WHICH', answer: ['The café', 'which is near the station', 'sells great soup.'], extra: ['who is near the station', 'it sells'] },
    { source: 'The nurse helped me. She was very kind.', cmd: 'JOIN WITH WHO/WHICH', answer: ['The nurse', 'who helped me', 'was very kind.'], extra: ['which helped me', 'she was'] },
  ],
  // B2
  [
    { source: 'I didn\'t study, so I failed the exam.', cmd: 'THIRD CONDITIONAL', answer: ['If I had studied,', 'I wouldn\'t have failed', 'the exam.'], extra: ['If I studied,', 'I won\'t fail'] },
    { source: 'We missed the train because we left late.', cmd: 'THIRD CONDITIONAL', answer: ['If we hadn\'t left late,', 'we wouldn\'t have missed', 'the train.'], extra: ['If we didn\'t leave late,', 'we wouldn\'t miss'] },
    { source: 'The wizard forgot the spell, so the door stayed locked.', cmd: 'THIRD CONDITIONAL', answer: ['If the wizard', 'hadn\'t forgotten the spell,', 'the door', 'wouldn\'t have stayed locked.'], extra: ['hadn\'t forgot the spell,', 'won\'t stay locked.'] },
    { source: 'I don\'t have a car.', cmd: 'USE WISH', answer: ['I wish', 'I had', 'a car.'], extra: ['I have', 'I will have'] },
    { source: 'I\'m sorry I shouted at my brother.', cmd: 'USE WISH', answer: ['I wish', 'I hadn\'t shouted', 'at my brother.'], extra: ['I didn\'t shout', 'I don\'t shout'] },
    { source: 'My neighbour plays loud music every night. It annoys me.', cmd: 'USE WISH', answer: ['I wish', 'my neighbour would stop', 'playing loud music.'], extra: ['my neighbour stops', 'to play loud music.'] },
    { source: 'People say that the lake is haunted.', cmd: 'PASSIVE REPORTING (It is said...)', answer: ['It is said', 'that the lake', 'is haunted.'], extra: ['It says', 'It is saying'] },
    { source: 'People believe that the castle is 800 years old.', cmd: 'PASSIVE REPORTING (It is said...)', answer: ['It is believed', 'that the castle', 'is 800 years old.'], extra: ['It believes', 'It was believe'] },
    { source: 'Experts think that walking improves memory.', cmd: 'PASSIVE REPORTING (It is said...)', answer: ['It is thought', 'that walking', 'improves memory.'], extra: ['It thinks', 'It is thinking'] },
    { source: 'People report that the storm has damaged many homes.', cmd: 'PASSIVE REPORTING (It is said...)', answer: ['It is reported', 'that the storm', 'has damaged many homes.'], extra: ['It reports', 'It is reporting'] },
  ],
  // C1
  [
    { source: 'I have never tasted such a delicious curry.', cmd: 'START WITH NEVER', answer: ['Never', 'have I tasted', 'such a delicious curry.'], extra: ['I have tasted', 'did I tasted'] },
    { source: 'She had never felt so welcome in a new city.', cmd: 'START WITH NEVER', answer: ['Never', 'had she felt', 'so welcome', 'in a new city.'], extra: ['she had felt', 'has she felt'] },
    { source: 'The guild has never accepted a dragon as a member.', cmd: 'START WITH NEVER', answer: ['Never', 'has the guild accepted', 'a dragon as a member.'], extra: ['the guild has accepted', 'did the guild accepted'] },
    { source: 'I need a long holiday.', cmd: 'START WITH WHAT', answer: ['What I need', 'is', 'a long holiday.'], extra: ['What do I need', 'are'] },
    { source: 'The ending of the novel surprised me.', cmd: 'START WITH WHAT', answer: ['What surprised me', 'was', 'the ending of the novel.'], extra: ['What did surprise me', 'were'] },
    { source: 'They decided to close the old bakery, which upset the town.', cmd: 'NOMINALISE', answer: ['Their decision', 'to close the old bakery', 'upset the town.'], extra: ['Their deciding', 'They decision'] },
    { source: 'The prices rose sharply, and shoppers were shocked.', cmd: 'NOMINALISE', answer: ['The sharp rise', 'in prices', 'shocked shoppers.'], extra: ['The sharply rise', 'of prices'] },
    { source: 'The apprentice failed, and the council was disappointed.', cmd: 'NOMINALISE', answer: ['The apprentice\'s failure', 'disappointed', 'the council.'], extra: ['The apprentice\'s failing of', 'disappointing'] },
    { source: 'If I had known about the delay, I would have taken a taxi.', cmd: 'HAD I KNOWN...', answer: ['Had I known', 'about the delay,', 'I would have taken', 'a taxi.'], extra: ['If had I known', 'I would take'] },
    { source: 'If we had known the bridge was closed, we would have gone another way.', cmd: 'HAD I KNOWN...', answer: ['Had we known', 'the bridge was closed,', 'we would have gone', 'another way.'], extra: ['Did we know', 'we had gone'] },
  ],
]
