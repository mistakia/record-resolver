const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Audiomack Album Tests', () => {

  const audiomack_url = 'https://audiomack.com/album/rapwisedotcom/ai-youngboy'
  describe(`Audiomack Album Test: ${audiomack_url}`, () => {
    let result

    before((done) => {
      resolver(audiomack_url, (err, info) => {
        result = info
        done(err)
      })
    })

    it('identify an audiomack album', () => {
      result.should.have.length(15)
    })

    it('identify audiomack id', () => {
      result[0].id.should.equal(3245616)
    })

    it('identify extractor as Audiomack:album', () => {
      result[0].extractor.should.equal('Audiomack:album')
    })

    it('identify stream url', () => {
      result[0].url.should.exist
    })

    /* it('identify thumbnail', () => {
     *   result[0].thumbnail.should.equal('https://i1.sndcdn.com/artworks-000008793437-pgni6l-t500x500.jpg')
     * })
     */

    it('identify title', () => {
      result[0].fulltitle.should.equal('AI YoungBoy - Trappin')
    })

    it('identify webpage url', () => {
      result[0].webpage_url.should.equal('https://audiomack.com/song/rapwisedotcom/trappin')
    })

    /* it('identify duration', () => {
     *   result[0]._duration_raw.should.equal(389)
     * })
     */
  })

})
