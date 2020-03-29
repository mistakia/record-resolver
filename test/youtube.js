const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Youtube Tests', () => {

  const video_url = 'http://www.youtube.com/watch?v=iODdvJGpfIA'
  describe(`Youtube Video Test: ${video_url}`, () => {
    let result

    before(async () => result = await resolver(video_url))

    it('identify a single video', () => {
      result.should.have.length(1)
    })

    it('identify youtube video id', () => {
      result[0].id.should.equal('iODdvJGpfIA')
    })

    it('identify extractor as youtube', () => {
      result[0].extractor.should.equal('youtube')
    })

    it('identify thumbnail', () => {
      result[0].thumbnail.should.equal('https://i.ytimg.com/vi/iODdvJGpfIA/hqdefault.jpg')
    })

    it('identify stream url', () => {
      result[0].url.should.exist
    })

    it('identify title', () => {
      result[0].fulltitle.should.equal('Fake Blood - Mars (Original Mix)')
    })

    it('identify duration', () => {
      result[0].duration.should.equal(262)
    })

    it('identify webpage url', () => {
      result[0].webpage_url.should.equal('https://www.youtube.com/watch?v=iODdvJGpfIA')
    })
  })
})
