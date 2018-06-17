const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Soundcloud Tests', () => {

  const soundcloud_url = 'http://soundcloud.com/skrillex/with-you-friends-long-drive'
  describe(`Soundcloud Track Test: ${soundcloud_url}`, () => {
    let result

    before((done) => {
      resolver(soundcloud_url, (err, info) => {
        result = info
        done(err)
      })
    })

    it('identify a single soundcloud track', () => {
      result.should.have.length(1)
    })

    it('identify soundcloud id', () => {
      result[0].id.should.equal('21792171')
    })

    it('identify extractor as soundcloud', () => {
      result[0].extractor.should.equal('soundcloud')
    })

    it('identify thumbnail', () => {
      result[0].thumbnail.should.equal('https://i1.sndcdn.com/artworks-000008793437-pgni6l-t500x500.jpg')
    })

    it('identify title', () => {
      result[0].fulltitle.should.equal('WITH YOU, FRIENDS (LONG DRIVE)')
    })

    it('identify duration', () => {
      result[0]._duration_raw.should.equal(389)
    })

  })

})
