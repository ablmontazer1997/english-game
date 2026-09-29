import type { ByLevel, Tale } from './types'

// Bard's Tale: lines are stored in the correct order.
export const TALES: ByLevel<Tale> = [
  // A1
  [
    { title: 'Morning', lines: [
      'First, Ana wakes up at seven.',
      'Then she eats bread and drinks milk.',
      'Finally, she walks to school.',
    ] },
    { title: 'The Little Dragon', lines: [
      'First, a little dragon finds an egg.',
      'Then the egg opens.',
      'Finally, a baby bird says hello to the dragon.',
    ] },
    { title: 'Making Tea', lines: [
      'First, Ben boils the water.',
      'Then he puts a tea bag in a cup of hot water.',
      'Finally, he drinks his tea.',
    ] },
    { title: 'At the Shop', lines: [
      'First, Mei takes a basket.',
      'Then she puts apples and milk in the basket.',
      'Finally, she pays and goes home.',
    ] },
    { title: 'Rainy Day', lines: [
      'First, the sky is grey.',
      'Then it rains a lot.',
      'Finally, the sun comes out and there is a rainbow.',
    ] },
    { title: 'The Green Cat', lines: [
      'First, the wizard makes a green potion.',
      'Then his cat drinks the potion.',
      'Finally, the cat is green!',
    ] },
    { title: 'Birthday', lines: [
      'First, Omar opens the door.',
      "Then his friends shout, 'Happy birthday!'",
      'Finally, they all eat cake.',
    ] },
    { title: 'Bedtime', lines: [
      'First, Lily brushes her teeth.',
      'Then her dad reads her a story.',
      'Finally, she goes to sleep.',
    ] },
  ],
  // A2
  [
    { title: 'A Day at the Beach', lines: [
      'First, Carlos and his sister took the bus to the beach.',
      'Then they swam in the sea for an hour.',
      'After that, they had sandwiches on the sand.',
      'Finally, they went home tired but happy.',
    ] },
    { title: 'The Lost Key', lines: [
      "Yesterday, Aisha couldn't find her house key.",
      "First, she looked in her bag, but it wasn't there.",
      'Then she called her brother, and he checked the car.',
      'Finally, he found the key under the seat.',
    ] },
    { title: 'The Broom Lesson', lines: [
      'First, the young witch sat on her new broom.',
      'Then she said the magic word, and the broom went up slowly.',
      'After that, she flew around the tower three times.',
      'Finally, she landed and her teacher smiled.',
    ] },
    { title: 'Cooking Dinner', lines: [
      'First, Tom cut the onions and the tomatoes.',
      'Then he cooked them in a pan with some oil.',
      'After that, he added rice and water.',
      'Finally, he served dinner to his family.',
    ] },
    { title: 'A New Friend', lines: [
      "On Monday, a new boy came to Nadia's class.",
      'He sat alone at lunch, so Nadia said hello.',
      'After that, they played football together.',
      'Now they are best friends.',
    ] },
    { title: 'The Train Trip', lines: [
      'First, Grandma bought two tickets at the station.',
      'Then she and Leo waited on the platform.',
      'After that, the train arrived ten minutes late.',
      'Finally, they sat by the window and watched the fields.',
    ] },
    { title: 'The Hungry Troll', lines: [
      'A hungry troll lived under an old bridge.',
      'One day, a girl crossed the bridge with a basket of cakes.',
      'She gave the troll three of her cakes.',
      'After that, the troll never frightened anyone again.',
    ] },
    { title: 'Growing Tomatoes', lines: [
      'In spring, Mrs Kim planted some tomato seeds.',
      'Every day after that, she gave them water.',
      'Two months later, the plants were tall and green.',
      'Finally, in summer, she picked red tomatoes.',
    ] },
  ],
  // B1
  [
    { title: 'The Job Interview', lines: [
      'Last week, Javier had an interview for a job at a hotel.',
      'Before it, he read about the hotel and practised his answers.',
      'However, on the day of the interview, his bus broke down.',
      'Luckily, he ran the last kilometre and arrived just in time.',
    ] },
    { title: "The Dragon's Cold", lines: [
      'One winter, the village dragon caught a terrible cold.',
      'Every time he sneezed, he set fire to a roof.',
      'As a result, the villagers made him a huge pot of honey soup.',
      'After drinking it, he felt better and his sneezes turned into harmless smoke.',
    ] },
    { title: 'Learning to Drive', lines: [
      'When Esra was eighteen, she decided to learn to drive.',
      'At first, she was so nervous that she stopped the car by mistake every few minutes.',
      'However, her instructor was patient, and she slowly improved.',
      'In the end, she passed her test on the first try.',
    ] },
    { title: 'The Wrong Suitcase', lines: [
      'After a long flight, Pavel took his suitcase from the belt and went to his hotel.',
      'When he opened it, he found dresses and a pair of red shoes inside.',
      "He realised he had taken someone else's suitcase by mistake.",
      'So he went straight back to the airport and exchanged it at the lost luggage office.',
    ] },
    { title: 'The School Garden', lines: [
      'A few years ago, the empty land behind our school was full of rubbish.',
      'Then a group of parents decided to turn it into a garden.',
      'They cleaned it, built wooden boxes and planted vegetables.',
      'Now students grow their own food there and use it in cooking lessons.',
    ] },
    { title: 'The Library Ghost', lines: [
      'Every morning, the librarian found books lying open on the tables.',
      'At first, she thought the cleaner was reading them at night.',
      'However, one evening she stayed late and saw a small, friendly ghost turning the pages.',
      'Since then, she has left a new book out for him every night.',
    ] },
    { title: 'The First Marathon', lines: [
      "Six months ago, Kemal couldn't run for more than five minutes.",
      'Then he downloaded a training plan and started running three times a week.',
      'Although the training was hard, he never missed a session.',
      'Last Sunday, he finished his first marathon.',
    ] },
    { title: 'The Wet Phone', lines: [
      'On Friday, Lin dropped her phone in a puddle.',
      "It wouldn't turn on, so she put it in a bag of rice overnight.",
      'The next morning, it still didn\'t work.',
      'In the end, she took it to a repair shop, and they fixed it for a small fee.',
    ] },
  ],
  // B2
  [
    { title: 'The Breakfast Cafe', lines: [
      'When Ahmed opened his cafe, only a handful of customers came each day.',
      'Rather than give up, he started asking them what they would like to see on the menu.',
      'Several of them mentioned that there was nowhere nearby to get a decent breakfast.',
      'He therefore began opening two hours earlier and serving eggs, pancakes and fresh juice.',
      'Within a year, there was a queue outside the door every morning.',
    ] },
    { title: 'The Stolen Moon', lines: [
      'Long ago, a greedy sorcerer stole the moon and hid it in a silver box.',
      'Without its light, sailors lost their way and farmers could not tell when to plant.',
      "Determined to help, a young fisher girl rowed across the sea to the sorcerer's island.",
      'While he was sleeping, she crept into his tower and opened the box.',
      "Instantly, the moon rose back into the sky, and the sorcerer's tower crumbled into the waves.",
    ] },
    { title: 'Working from Home', lines: [
      'When Sofia first started working from home, she loved not having to commute.',
      'Before long, however, she realised she was working longer hours than ever.',
      'She often answered emails late at night and forgot to take proper breaks.',
      'Eventually, she decided to set clear rules, such as closing her laptop at six.',
      'As a result, she became both happier and more productive.',
    ] },
    { title: 'The Sourdough Baker', lines: [
      'Having trained for years in the city, Marek returned to his village to open a bakery.',
      'At first, the villagers were suspicious of his unusual sourdough loaves.',
      'Meanwhile, the old bakery across the street continued to sell the same white bread as always.',
      'Things changed when Marek offered free samples at the Saturday market.',
      'By the end of the summer, his loaves were selling out before noon.',
    ] },
    { title: 'The Recycling Campaign', lines: [
      'Our town used to send almost all of its rubbish to a landfill site.',
      'Concerned about this, a group of teenagers launched a campaign to promote recycling.',
      'They not only gave talks in schools but also put up posters in every shop.',
      'Despite some early resistance, more and more families began to separate their waste.',
      'Two years later, the amount of rubbish going to landfill had fallen by half.',
    ] },
    { title: 'The Guild Exam', lines: [
      "For months, Ilyas had been preparing for the Mages' Guild entrance exam.",
      'On the morning of the test, however, he woke up with a fever.',
      'Although he could barely stand, he insisted on going.',
      'Halfway through the practical exam, his fire spell fizzled out completely.',
      'Impressed by his determination, the examiners allowed him to retake it the following week.',
    ] },
    { title: 'Fog on the Mountain', lines: [
      'Two friends set off to hike to a mountain lake, expecting to be back by lunchtime.',
      'A few hours in, thick fog rolled in and they lost sight of the path.',
      'Instead of panicking, they stopped and checked the map on one of their phones.',
      'Using the GPS, they slowly found their way back to the trail.',
      'By the time they reached the car, it was dark, but they were safe.',
    ] },
    { title: 'The Piano Upstairs', lines: [
      'For weeks, Hannah was kept awake by piano music coming from the flat upstairs.',
      'Tired and irritated, she finally went up to complain.',
      'To her surprise, the door was opened by an elderly man who apologised warmly.',
      'He explained that he was practising for a concert, his first in thirty years.',
      'Touched by his story, Hannah ended up buying a ticket and cheering in the front row.',
    ] },
  ],
  // C1
  [
    { title: 'The Mapmaker', lines: [
      "For decades, the kingdom's maps had been drawn by a single elderly cartographer.",
      'When she finally retired, no one else knew how to survey the treacherous northern passes.',
      'Undeterred, her former apprentice set out alone to chart them, armed only with her notebooks.',
      'Not only did he complete the survey, but he also discovered a shorter route through the valley.',
      "The new road, which now bears his teacher's name, has cut the journey by three days.",
    ] },
    { title: 'The Farming App', lines: [
      'Having left a well-paid job at a bank, Priya poured her savings into an app for local farmers.',
      'Initially, the idea seemed doomed, as few farmers owned smartphones at the time.',
      'Rather than abandon the project, she redesigned it to work through simple text messages.',
      'Word soon spread from village to village, and within months thousands had signed up.',
      'What had once looked like a reckless gamble turned out to be the smartest decision of her career.',
    ] },
    { title: 'The Silent Bell', lines: [
      'Legend has it that the bell in the old tower had not rung for a hundred years.',
      'Many had tried to repair it, yet none could produce even the faintest sound.',
      'One stormy night, however, it began to ring of its own accord, and the frightened villagers fled to the hills.',
      'The following morning, they learned that the dam upstream had burst during the night.',
      "Had it not been for the bell's warning, the whole village would have been swept away.",
    ] },
    { title: 'Burnout', lines: [
      'At first, Tomasz thrived on the pressure of his new role as project manager.',
      'Gradually, though, the late nights began to take their toll on his health.',
      'It was only when he fainted during a meeting that he acknowledged the problem.',
      "Following his doctor's advice, he negotiated a four-day week with his employer.",
      "Ironically, his team's performance has improved since he started working less.",
    ] },
    { title: "The Translator's Dilemma", lines: [
      'Kofi was hired to interpret at a tense meeting between two rival merchant guilds.',
      'Midway through, one leader made a remark that was clearly intended as an insult.',
      'Aware that a literal translation might end the negotiations, Kofi softened the wording slightly.',
      'Consequently, the talks continued, and by evening both sides had signed an agreement.',
      'Nevertheless, he still wonders whether he had the right to change what was said.',
    ] },
    { title: 'The Rooftop Bees', lines: [
      "When a group of office workers proposed keeping bees on their company's roof, management was sceptical.",
      'Concerns were raised about stings, insurance and the potential impact on the building.',
      'Nonetheless, the employees persisted, presenting research that showed the risks to be minimal.',
      'Reluctantly, the board agreed to a six-month trial.',
      'Two years on, the rooftop hives produce honey for the staff canteen, and the scheme has been copied across the city.',
    ] },
    { title: 'The Dragon Treaty', lines: [
      'For generations, the mountain dragons and the valley farmers had regarded each other with deep suspicion.',
      'Whenever livestock went missing, the dragons were blamed, often without evidence.',
      "Then, one harsh winter, a dragon rescued a farmer's child who had become trapped in the snow.",
      'This single act of kindness prompted the first ever meeting between the two communities.',
      'The treaty they signed that spring has held, remarkably, for over fifty years.',
    ] },
    { title: 'A Second Language', lines: [
      "As a child, Elif refused to speak her grandmother's language, embarrassed that it marked her as different.",
      'It was not until her grandmother fell ill that she began to regret this.',
      'Determined to make up for lost time, she enrolled in evening classes and practised with relatives on the phone.',
      'By the time her grandmother recovered, Elif could hold a simple conversation with her.',
      'Today she speaks it fluently and is teaching it to her own children.',
    ] },
  ],
]
