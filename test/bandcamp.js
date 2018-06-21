const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Bandcamp Tests', () => {

  const bandcamp_url = 'http://youtube-dl.bandcamp.com/track/youtube-dl-test-song'
  describe(`Bandcamp Track Test: ${bandcamp_url}`, () => {
    let result

    before((done) => {
      resolver(bandcamp_url, (err, info) => {
        result = info
        done(err)
      })
    })

    it('identify a single bandcamp track', () => {
      result.should.have.length(1)
    })

    it('identify bandcamp id', () => {
      result[0].id.should.equal(1812978515)
    })

    it('identify extractor as Bandcamp', () => {
      result[0].extractor.should.equal('Bandcamp')
    })

    it('identify stream url', () => {
      result[0].url.should.exist
    })

    it('identify thumbnail', () => {
      result[0].thumbnail.should.equal('https://f4.bcbits.com/img/a3216802731_5.jpg')
    })

    it('identify title', () => {
      result[0].fulltitle.should.equal('youtube-dl  "\'/\\ä↭ - youtube-dl test song "\'/\\ä↭')
    })

    it('identify duration', () => {
      result[0].duration.should.equal(9.8485)
    })

  })

})
