const { pool } = require('../../db/pool');
const { spkRepository } = require('./spk.repository');
const { injectBranchFilter } = require('../../common/branch-filter-helper');

async function test() {
  try {
    const user = { email_sat: 'test@sat.co.id', cabang: 'KOTABUMI', roles: ['BRANCH BUILDING SUPPORT'] };
    let query = { status: 'SPK_APPROVED' };
    query = await injectBranchFilter(user, query);
    const data = await spkRepository.list(query);
    const lz01 = data.find(s => s.nomor_ulok === 'LZ01-2606-0004');
    console.log('LZ01 object keys:', lz01 ? Object.keys(lz01) : 'not found');
    console.log('LZ01 id_toko:', lz01?.id_toko);
    console.log('LZ01 full:', JSON.stringify(lz01, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
test();
