const chai = require('chai')

const should = chai.should()
const resolver = require('../')

describe('8tracks Tests', () => {

  const etracks_url = 'http://8tracks.com/larecreative/jeux-d-eau'
  describe(`8tracks Track Test: ${etracks_url}`, () => {
    /* let result

     * before(async () => result = await resolver(etracks_url))

     * it('identify a 8tracks mix', () => {
     *   result.should.have.length(9)
     * })

     * it('identify 8tracks id', () => {
     *   result[0].id.should.equal('8765737')
     * })

     * it('identify extractor as 8tracks', () => {
     *   result[0].extractor.should.equal('8tracks')
     * })

     * it('identify stream url', () => {
     *   result[0].url.should.equal('http://cft.8tracks.com/tf/031/423/715/VEI1lk.48k.v3.m4a')
     * })

     * it('identify thumbnail', () => {
     *   result[0].thumbnail.should.equal('https://i1.sndcdn.com/artworks-000008793437-pgni6l-t500x500.jpg')
     * })
     *
     * it('identify title', () => {
     *   result[0].fulltitle.should.equal('Edward Sharpe And The Magnetic Zeros - Man On Fire')
     * })

     * it('identify webpage url', () => {
     *   result[0].webpage_url.should.equal('http://8tracks.com/tracks/8765737')
     * })

     * it('identify duration', () => {
     *   result[0]._duration_raw.should.equal(389)
     * }) */
  })
})
