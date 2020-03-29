const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Hypem Tests', () => {

  const hypem_url = 'https://hypem.com/track/1m2fk/Ta-ku+-+Higher+(Flume+Remix)'
  describe(`Hypem Track Test: ${hypem_url}`, () => {
    let result

    before(async () => result = await resolver(hypem_url))

    it('identify a single hypem track', () => {
      result.should.have.length(1)
    })

    it('identify hypem id', () => {
      result[0].id.should.equal('1m2fk')
    })

    it('identify extractor as hypem', () => {
      result[0].extractor.should.equal('Hypem')
    })

    it('identify stream url', () => {
      result[0].url.should.be.ok
    })

    /* it('identify thumbnail', () => {
     *   result[0].thumbnail.should.equal('https://static.hypem.com/items_images/f3/1m2fk_500.jpg')
     * })
     */
    it('identify title', () => {
      result[0].fulltitle.should.equal('Higher (Flume Remix)')
    })

    it('identify webpage url', () => {
      result[0].webpage_url.should.equal('https://hypem.com/track/1m2fk/Ta-ku+-+Higher+(Flume+Remix)')
    })
  })
})
