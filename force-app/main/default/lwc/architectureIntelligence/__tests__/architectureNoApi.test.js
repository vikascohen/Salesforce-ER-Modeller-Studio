import fs from 'fs';
import path from 'path';

describe('Architecture Intelligence local-analysis boundary', () => {
    it('keeps the architecture engine free of Apex and Tooling API imports', () => {
        const bundle = path.resolve(process.cwd(), 'force-app/main/default/lwc/architectureIntelligence');
        const files = fs.readdirSync(bundle).filter(name => name.endsWith('.js'));
        const source = files.map(name => fs.readFileSync(path.join(bundle, name), 'utf8')).join('\n');
        expect(source).not.toContain('@salesforce/apex/');
        expect(source).not.toContain('FieldUsageController');
    });
});
