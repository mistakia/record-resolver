const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('Audiomack Album Tests', () => {

  const audiomack_url = 'https://audiomack.com/album/roddyricch/please-excuse-me-for-being-antisocial'
  describe(`Audiomack Album Test: ${audiomack_url}`, () => {
    let result

    before(async () => result = await resolver(audiomack_url))

    it('identify an audiomack album', () => {
      result.should.have.length(16)
    })

    it('identify audiomack id', () => {
      result[0].id.should.equal('7779773')
    })

    it('identify extractor as Audiomack:album', () => {
      result[0].extractor.should.equal('audiomack:album')
    })

    it('identify stream url', () => {
      result[0].url.should.exist
    })

    /* it('identify thumbnail', () => {
     *   result[0].thumbnail.should.equal('https://i1.sndcdn.com/artworks-000008793437-pgni6l-t500x500.jpg')
     * })
     */
    it('identify title', () => {
      result[0].fulltitle.should.equal('Please Excuse Me For Being Antisocial - Intro')
    })

    it('identify webpage url', () => {
      result[0].webpage_url.should.equal('https://audiomack.com/album/roddyricch/please-excuse-me-for-being-antisocial')
    })

    /* it('identify duration', () => {
     *   result[0].duration.should.equal(389)
     * }) */
  })
})
