// Commentary data with multiple authors and works
// This structure supports multiple commentators, each with multiple works

export const authors = [
  {
    id: 'gavin-ortlund',
    name: 'Gavin Ortlund',
    bio: 'Pastor and theologian, author of theological works and host of Truth Unites YouTube channel.',
    works: [
      {
        id: 'ortlund-every-chapter',
        title: 'Explaining Every Chapter of Revelation',
        type: 'Video Teaching',
        timestamp: '3:45:00',
        year: 2024,
        commentaries: [] // Will be populated from JSON
      }
    ]
  },
  {
    id: 'john-macarthur',
    name: 'John MacArthur',
    bio: 'Pastor of Grace Community Church and author of the MacArthur Study Bible.',
    works: [
      {
        id: 'macarthur-revelation-1',
        title: 'Because the Time Is Near',
        type: 'Book',
        year: 2007,
        commentaries: [
          {
            id: 'mac_1_1_3',
            reference: 'Revelation 1:1-3',
            verses: [
              { chapter: 1, verse: 1 },
              { chapter: 1, verse: 2 },
              { chapter: 1, verse: 3 }
            ],
            chapter: 1,
            text: "The book of Revelation is the only New Testament book that begins by specifically promising blessing to those who read it and obey its message. The Greek word translated 'revelation' is apokalypsis, from which the English word apocalypse derives.\n\nThis revelation came from God the Father, through Jesus Christ, by means of an angel, to John, and finally to the servants of God—the church. The chain of transmission demonstrates both the divine origin and the intended human audience of this prophecy."
          },
          {
            id: 'mac_1_4_8',
            reference: 'Revelation 1:4-8',
            verses: [
              { chapter: 1, verse: 4 },
              { chapter: 1, verse: 5 },
              { chapter: 1, verse: 6 },
              { chapter: 1, verse: 7 },
              { chapter: 1, verse: 8 }
            ],
            chapter: 1,
            text: "John greets the seven churches with grace and peace from the triune God. The unique description of God as 'Him who is and who was and who is to come' emphasizes His eternal, unchanging nature.\n\nJesus Christ is described with three titles: the faithful witness, the firstborn from the dead, and the ruler of the kings of the earth. Each title reveals an aspect of His work and authority."
          },
          {
            id: 'mac_6_1_8',
            reference: 'Revelation 6:1-8',
            verses: [
              { chapter: 6, verse: 1 },
              { chapter: 6, verse: 2 },
              { chapter: 6, verse: 3 },
              { chapter: 6, verse: 4 },
              { chapter: 6, verse: 5 },
              { chapter: 6, verse: 6 },
              { chapter: 6, verse: 7 },
              { chapter: 6, verse: 8 }
            ],
            chapter: 6,
            text: "The four horsemen represent the beginning of God's judgment on the earth during the tribulation. The white horse rider is not Christ (as some suggest) but represents the Antichrist, who comes as a false peacemaker.\n\nThe red horse represents warfare, the black horse represents famine, and the pale horse represents death. These four judgments will affect one-fourth of the earth's population."
          },
          {
            id: 'mac_13_1_10',
            reference: 'Revelation 13:1-10',
            verses: [
              { chapter: 13, verse: 1 },
              { chapter: 13, verse: 2 },
              { chapter: 13, verse: 3 },
              { chapter: 13, verse: 4 },
              { chapter: 13, verse: 5 },
              { chapter: 13, verse: 6 },
              { chapter: 13, verse: 7 },
              { chapter: 13, verse: 8 },
              { chapter: 13, verse: 9 },
              { chapter: 13, verse: 10 }
            ],
            chapter: 13,
            text: "The beast from the sea represents the final world ruler, the Antichrist. His seven heads and ten horns connect him with the dragon (Satan) and indicate his vast political power.\n\nThe beast's fatal wound that was healed may refer to a literal assassination and resurrection, or to the revival of a former world empire. Either way, it will cause the world to marvel and worship the beast."
          }
        ]
      },
      {
        id: 'macarthur-sermons',
        title: 'Revelation Sermon Series',
        type: 'Sermon Series',
        year: 2019,
        commentaries: [
          {
            id: 'mac_ser_1_9_20',
            reference: 'Revelation 1:9-20',
            verses: [
              { chapter: 1, verse: 9 },
              { chapter: 1, verse: 10 },
              { chapter: 1, verse: 11 },
              { chapter: 1, verse: 12 },
              { chapter: 1, verse: 13 },
              { chapter: 1, verse: 14 },
              { chapter: 1, verse: 15 },
              { chapter: 1, verse: 16 },
              { chapter: 1, verse: 17 },
              { chapter: 1, verse: 18 },
              { chapter: 1, verse: 19 },
              { chapter: 1, verse: 20 }
            ],
            chapter: 1,
            text: "John's vision of Christ in His glory is one of the most magnificent Christophanies in Scripture. Every detail reveals something about our Lord's divine nature and authority.\n\nThe long robe speaks of His priestly dignity. The golden sash speaks of His royal authority. His white hair speaks of His eternal wisdom. His eyes like fire speak of His omniscient judgment. His feet of bronze speak of His firm stance in judgment. His voice like many waters speaks of His awesome power."
          },
          {
            id: 'mac_ser_4_1_11',
            reference: 'Revelation 4:1-11',
            verses: [
              { chapter: 4, verse: 1 },
              { chapter: 4, verse: 2 },
              { chapter: 4, verse: 3 },
              { chapter: 4, verse: 4 },
              { chapter: 4, verse: 5 },
              { chapter: 4, verse: 6 },
              { chapter: 4, verse: 7 },
              { chapter: 4, verse: 8 },
              { chapter: 4, verse: 9 },
              { chapter: 4, verse: 10 },
              { chapter: 4, verse: 11 }
            ],
            chapter: 4,
            text: "Heaven's throne room is the command center of the universe. Everything proceeds from God's throne, and everything will one day answer to it.\n\nThe twenty-four elders represent the redeemed church in heaven. The four living creatures represent the highest order of angelic beings. Together, they lead all of heaven in ceaseless worship of the One who sits on the throne."
          }
        ]
      }
    ]
  },
  {
    id: 'rc-sproul',
    name: 'R.C. Sproul',
    bio: 'Founder of Ligonier Ministries and author of numerous theological works.',
    works: [
      {
        id: 'sproul-last-days',
        title: 'The Last Days According to Jesus',
        type: 'Book',
        year: 1998,
        commentaries: [
          {
            id: 'sproul_1_1_3',
            reference: 'Revelation 1:1-3',
            verses: [
              { chapter: 1, verse: 1 },
              { chapter: 1, verse: 2 },
              { chapter: 1, verse: 3 }
            ],
            chapter: 1,
            text: "The time-frame references in Revelation are crucial for interpretation. When John writes that these things 'must soon take place' and 'the time is near,' we must take these temporal indicators seriously.\n\nThis doesn't mean that nothing in Revelation pertains to the distant future, but it does mean that the original audience expected at least some fulfillment in their lifetime. The book was meant to bring comfort and instruction to first-century Christians facing persecution."
          },
          {
            id: 'sproul_6_12_17',
            reference: 'Revelation 6:12-17',
            verses: [
              { chapter: 6, verse: 12 },
              { chapter: 6, verse: 13 },
              { chapter: 6, verse: 14 },
              { chapter: 6, verse: 15 },
              { chapter: 6, verse: 16 },
              { chapter: 6, verse: 17 }
            ],
            chapter: 6,
            text: "The cosmic imagery of the sixth seal draws from Old Testament prophetic language. Similar language was used to describe the fall of Babylon, Egypt, and other nations.\n\nThis apocalyptic imagery represents the dramatic upheaval of the established order. Whether fulfilled in AD 70, in a future tribulation, or progressively throughout history, the message is clear: God will judge the rebellious and vindicate His people."
          },
          {
            id: 'sproul_20_1_6',
            reference: 'Revelation 20:1-6',
            verses: [
              { chapter: 20, verse: 1 },
              { chapter: 20, verse: 2 },
              { chapter: 20, verse: 3 },
              { chapter: 20, verse: 4 },
              { chapter: 20, verse: 5 },
              { chapter: 20, verse: 6 }
            ],
            chapter: 20,
            text: "The millennium has been one of the most debated passages in church history. The three main views—premillennialism, postmillennialism, and amillennialism—each have strong advocates throughout church history.\n\nWhat unites all orthodox interpreters is the certainty of Christ's victory, the reality of final judgment, and the hope of eternal life for all who trust in Him. The specific timing and nature of the millennium should not divide believers."
          }
        ]
      }
    ]
  }
]

// Function to load Ortlund's commentaries from the JSON file
export function loadOrtlundCommentaries(commentaryData) {
  const ortlund = authors.find(a => a.id === 'gavin-ortlund')
  if (ortlund && ortlund.works[0]) {
    ortlund.works[0].commentaries = commentaryData.commentaries
  }
  return authors
}

// Get all commentaries for a specific chapter from a specific author/work
export function getCommentariesForChapter(authorId, workId, chapter) {
  const author = authors.find(a => a.id === authorId)
  if (!author) return []
  
  const work = author.works.find(w => w.id === workId)
  if (!work) return []
  
  return work.commentaries.filter(c => c.chapter === chapter && c.verses)
}

// Check if a verse has commentary from any author
export function hasAnyCommentary(chapter, verse, authorsData) {
  return authorsData.some(author =>
    author.works.some(work =>
      work.commentaries.some(c =>
        c.verses && c.verses.some(v => v.chapter === chapter && v.verse === verse)
      )
    )
  )
}

// Get commentary for a specific verse from current author/work
export function getCommentaryForVerse(authorId, workId, chapter, verse, authorsData) {
  const author = authorsData.find(a => a.id === authorId)
  if (!author) return null
  
  const work = author.works.find(w => w.id === workId)
  if (!work) return null
  
  return work.commentaries.find(c =>
    c.verses && c.verses.some(v => v.chapter === chapter && v.verse === verse)
  )
}
