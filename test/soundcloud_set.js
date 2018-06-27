const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Soundcloud Set Tests', () => {

  const soundcloud_url = 'http://soundcloud.com/skrillex/sets/scary-monsters-and-nice'
  describe(`Soundcloud Set Test: ${soundcloud_url}`, () => {
    let result

    before((done) => {
      resolver(soundcloud_url, (err, info) => {
        result = info
        done(err)
      })
    })

    it('identify a soundcloud set', () => {
      result.should.have.length(9)
    })

    it('identify soundcloud id', () => {
      result[0].id.should.equal(21792165)
    })

    it('identify extractor as soundcloud', () => {
      result[0].extractor.should.equal('Soundcloud:set')
    })

    it('identify stream url', () => {
      result[0].url.should.exist
    })

    it('identify thumbnail', () => {
      result[0].thumbnail.should.equal('https://i1.sndcdn.com/artworks-000008793437-pgni6l-t500x500.jpg')
    })

    it('identify title', () => {
      result[0].fulltitle.should.equal('ROCK N\' ROLL (WILL TAKE YOU TO THE MOUNTAIN)')
    })

    it('identify duration', () => {
      result[0].duration.should.equal(284)
    })

    it('identify webpage url', () => {
      result[0].webpage_url.should.equal('http://soundcloud.com/skrillex/rock-n-roll-will-take-you-to')
    })
  })
})
