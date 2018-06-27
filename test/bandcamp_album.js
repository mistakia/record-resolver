const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Bandcamp Album Tests', () => {

  const bandcamp_url = 'http://blazo.bandcamp.com/album/jazz-format-mixtape-vol-1'
  describe(`Bandcamp Album Test: ${bandcamp_url}`, () => {
    let result

    before((done) => {
      resolver(bandcamp_url, (err, info) => {
        result = info
        done(err)
      })
    })

    it('identify a 22 bandcamp tracks', () => {
      result.should.have.length(22)
    })

    it('identify bandcamp id', () => {
      result[0].id.should.equal(1353101989)
    })

    it('identify extractor as Bandcamp:album', () => {
      result[0].extractor.should.equal('Bandcamp:album')
    })

    it('identify stream url', () => {
      result[0].url.should.exist
    })

    it('identify thumbnail', () => {
      result[0].thumbnail.should.equal('https://f4.bcbits.com/img/a1721150828_5.jpg')
    })

    it('identify title', () => {
      result[0].fulltitle.should.equal('Intro')
    })

    it('identify webpage url', () => {
      result[0].webpage_url.should.equal('http://blazo.bandcamp.com/track/nujabes-the-final-view')
    })

    it('identify duration', () => {
      result[0].duration.should.equal(19.335)
    })

  })

})
