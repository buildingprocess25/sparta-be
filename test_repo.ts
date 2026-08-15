import { dcDevelopmentRepository } from './src/modules/dc-development/dc-development.repository';
import { pool } from './src/db/pool';

(async () => {
    try {
        const query: any = { actor_email: 'test@example.com', actor_role: 'DC_MANAGER' };
        const projects = await dcDevelopmentRepository.listArchiveProjects(query, true);
        console.log('Projects count without filters:', projects.length);
        
        const queryWithUndefined: any = { actor_email: 'test@example.com', actor_role: 'DC_MANAGER', branch_name: "undefined" };
        const projectsWithUndef = await dcDevelopmentRepository.listArchiveProjects(queryWithUndefined, true);
        console.log('Projects count with branch_name="undefined":', projectsWithUndef.length);
    } catch(e: any) {
        console.error('Error:', e.message);
    } finally {
        pool.end();
        process.exit();
    }
})();
