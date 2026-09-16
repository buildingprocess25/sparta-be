import { getEffectiveBranchesForUser } from './src/common/branch-scope';

async function main() {
    const scope = await getEffectiveBranchesForUser({
       emailSat: 'obakontraktor@gmail.com',
       cabang: 'CIKOKOL',
       roles: ['KONTRAKTOR']
    });
    console.log(scope);
    process.exit(0);
}
main();
