const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Soundcloud Plalist Tests', () => {

  const soundcloud_url = 'https://api.soundcloud.com/playlists/4110309'
  describe(`Soundcloud Playlist Test: ${soundcloud_url}`, () => {
    let result

    before((done) => {
      resolver(soundcloud_url, (err, info) => {
        result = info
        done(err)
      })
    })

    it('identify a soundcloud set', () => {
      result.should.have.length(6)
    })

    it('identify soundcloud id', () => {
      result[0].id.should.equal(83411137)
    })

    it('identify extractor as soundcloud', () => {
      result[0].extractor.should.equal('Soundcloud:playlist')
    })

    it('identify stream url', () => {
      result[0].url.should.exist
    })

    it('identify thumbnail', () => {
      result[0].thumbnail.should.equal('https://i1.sndcdn.com/artworks-000043059968-sy1bg1-t500x500.jpg')
    })

    it('identify title', () => {
      result[0].fulltitle.should.equal('TILT Brass Band improv - Sak Passé? (2003)')
    })

    it('identify duration', () => {
      result[0].duration.should.equal(122)
    })

  })

})
