import fs from 'fs';
import path from 'path';

describe('architecture intelligence bundle metadata', () => {
    it('keeps exactly one Lightning bundle metadata descriptor', () => {
        const bundle = path.resolve(process.cwd(), 'force-app/main/default/lwc/architectureIntelligence');
        const meta = fs.readdirSync(bundle).filter(name => name.endsWith('.js-meta.xml'));
        expect(meta).toEqual(['architectureIntelligence.js-meta.xml']);
    });
});
