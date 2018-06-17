const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Youtube Tests', () => {

  const video_url = 'http://www.youtube.com/watch?v=iODdvJGpfIA'
  describe(`Youtube Video Test: ${video_url}`, () => {
    let result

    before((done) => {
      resolver(video_url, (err, info) => {
        result = info
        done(err)
      })
    })

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

    it('identify title', () => {
      result[0].fulltitle.should.equal('Fake Blood - Mars (Original Mix)')
    })

    it('identify duration', () => {
      result[0]._duration_raw.should.equal(262)
    })

  })

})
