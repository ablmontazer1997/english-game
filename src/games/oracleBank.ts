// Oracle Trial question bank: English only, tagged by CEFR level and skill.
// A prototype set; the real bank will come from the content service.

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const

export interface OracleQ {
  id: string
  level: number // index into LEVELS
  skill: 'Grammar' | 'Vocabulary' | 'Reading'
  prompt: string
  answer: string
  wrong: string[]
}

export const ORACLE_BANK: OracleQ[] = [
  // A1
  { id: 'a1-1', level: 0, skill: 'Grammar', prompt: 'She ___ to the market every Sunday.', answer: 'goes', wrong: ['go', 'going', 'gone'] },
  { id: 'a1-2', level: 0, skill: 'Grammar', prompt: 'There ___ two cats in the garden.', answer: 'are', wrong: ['is', 'am', 'be'] },
  { id: 'a1-3', level: 0, skill: 'Vocabulary', prompt: 'You use it to open a door. It is a ___.', answer: 'key', wrong: ['cup', 'shoe', 'bird'] },
  { id: 'a1-4', level: 0, skill: 'Grammar', prompt: 'I ___ a student.', answer: 'am', wrong: ['is', 'are', 'be'] },
  { id: 'a1-5', level: 0, skill: 'Vocabulary', prompt: 'The opposite of "hot" is ___.', answer: 'cold', wrong: ['big', 'fast', 'old'] },
  { id: 'a1-6', level: 0, skill: 'Grammar', prompt: '___ you like apples?', answer: 'Do', wrong: ['Does', 'Are', 'Is'] },
  // A2
  { id: 'a2-1', level: 1, skill: 'Grammar', prompt: 'Yesterday we ___ a film at the cinema.', answer: 'watched', wrong: ['watch', 'watches', 'watching'] },
  { id: 'a2-2', level: 1, skill: 'Grammar', prompt: 'This tower is ___ than that one.', answer: 'taller', wrong: ['tall', 'tallest', 'more tall'] },
  { id: 'a2-3', level: 1, skill: 'Vocabulary', prompt: 'A person who cooks food in a restaurant is a ___.', answer: 'chef', wrong: ['pilot', 'farmer', 'judge'] },
  { id: 'a2-4', level: 1, skill: 'Grammar', prompt: 'I have lived here ___ 2019.', answer: 'since', wrong: ['for', 'from', 'at'] },
  { id: 'a2-5', level: 1, skill: 'Reading', prompt: '"The shop opens at 9 and closes at 5." When can you NOT buy anything?', answer: 'at 7 p.m.', wrong: ['at 10 a.m.', 'at noon', 'at 3 p.m.'] },
  { id: 'a2-6', level: 1, skill: 'Grammar', prompt: 'We ___ going to visit Grandma tomorrow.', answer: 'are', wrong: ['is', 'will', 'have'] },
  // B1
  { id: 'b1-1', level: 2, skill: 'Grammar', prompt: 'If it rains tomorrow, we ___ at home.', answer: 'will stay', wrong: ['stayed', 'would stayed', 'stay will'] },
  { id: 'b1-2', level: 2, skill: 'Grammar', prompt: 'I have never ___ a dragon before.', answer: 'seen', wrong: ['saw', 'see', 'seeing'] },
  { id: 'b1-3', level: 2, skill: 'Vocabulary', prompt: 'She was so ___ that she fell asleep in class.', answer: 'exhausted', wrong: ['excited', 'curious', 'generous'] },
  { id: 'b1-4', level: 2, skill: 'Grammar', prompt: 'The castle ___ built five hundred years ago.', answer: 'was', wrong: ['is', 'has', 'were'] },
  { id: 'b1-5', level: 2, skill: 'Vocabulary', prompt: 'Please ___ the form before you leave.', answer: 'fill in', wrong: ['fill up', 'fill over', 'fill at'] },
  { id: 'b1-6', level: 2, skill: 'Reading', prompt: '"Despite the storm, the ship reached the island." What happened?', answer: 'The ship arrived.', wrong: ['The ship sank.', 'The storm stopped.', 'The ship turned back.'] },
  // B2
  { id: 'b2-1', level: 3, skill: 'Grammar', prompt: 'If I ___ about the trap, I would have warned you.', answer: 'had known', wrong: ['knew', 'have known', 'would know'] },
  { id: 'b2-2', level: 3, skill: 'Grammar', prompt: 'By the time we arrived, the feast ___.', answer: 'had already begun', wrong: ['already began', 'has already begun', 'was already begin'] },
  { id: 'b2-3', level: 3, skill: 'Vocabulary', prompt: 'The wizard\'s claims were ___: nobody could prove them.', answer: 'unverifiable', wrong: ['unbreakable', 'unforgettable', 'unavoidable'] },
  { id: 'b2-4', level: 3, skill: 'Grammar', prompt: 'She suggested ___ the northern path.', answer: 'taking', wrong: ['to take', 'take', 'took'] },
  { id: 'b2-5', level: 3, skill: 'Vocabulary', prompt: 'We need to ___ the problem before it gets worse.', answer: 'tackle', wrong: ['tickle', 'topple', 'tumble'] },
  { id: 'b2-6', level: 3, skill: 'Reading', prompt: '"Hardly had the gate opened when the crowd rushed in." When did the crowd enter?', answer: 'Right after it opened.', wrong: ['Long after it opened.', 'Before it opened.', 'It never opened.'] },
  // C1
  { id: 'c1-1', level: 4, skill: 'Grammar', prompt: 'Not only ___ the riddle, but she also found the key.', answer: 'did she solve', wrong: ['she solved', 'she did solve', 'solved she'] },
  { id: 'c1-2', level: 4, skill: 'Vocabulary', prompt: 'His argument was so ___ that everyone changed their mind.', answer: 'compelling', wrong: ['complacent', 'compliant', 'compulsive'] },
  { id: 'c1-3', level: 4, skill: 'Grammar', prompt: 'Were it not for your help, we ___ lost.', answer: 'would be', wrong: ['will be', 'were', 'had been'] },
  { id: 'c1-4', level: 4, skill: 'Vocabulary', prompt: 'The treaty was signed, but tensions remained ___ beneath the surface.', answer: 'simmering', wrong: ['shimmering', 'soaring', 'sheltering'] },
  { id: 'c1-5', level: 4, skill: 'Reading', prompt: '"Her praise was, at best, lukewarm." How did she feel?', answer: 'Not very impressed.', wrong: ['Very excited.', 'Angry.', 'Completely confused.'] },
  { id: 'c1-6', level: 4, skill: 'Grammar', prompt: 'It\'s high time we ___ for the mountains.', answer: 'set off', wrong: ['set of', 'will set off', 'have set off'] },
]
