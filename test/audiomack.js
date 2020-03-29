const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Audiomack Tests', () => {

  const audiomack_url = 'http://www.audiomack.com/song/roosh-williams/extraordinary'
  describe(`Audiomack Track Test: ${audiomack_url}`, () => {
    let result

    before(async () => result = await resolver(audiomack_url))

    it('identify a single audiomack track', () => {
      result.should.have.length(1)
    })

    it('identify audiomack id', () => {
      result[0].id.should.equal('310086')
    })

    it('identify extractor as audiomack', () => {
      result[0].extractor.should.equal('audiomack')
    })

    it('identify stream url', () => {
      result[0].url.should.exist
    })

    /* it('identify thumbnail', () => {
     *   result[0].thumbnail.should.equal('https://i1.sndcdn.com/artworks-000008793437-pgni6l-t500x500.jpg')
     * })
     */
    it('identify title', () => {
      result[0].fulltitle.should.equal('Extraordinary')
    })

    it('identify webpage url', () => {
      result[0].webpage_url.should.equal('http://www.audiomack.com/song/roosh-williams/extraordinary')
    })

    /* it('identify duration', () => {
     *   result[0].duration.should.equal(389)
     * }) */
  })
})
