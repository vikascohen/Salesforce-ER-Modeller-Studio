import {
    ER_SAMPLE,
    parseEr,
    buildErGeometry,
    buildMermaidErDiagram,
    buildDrawioXml,
    buildLegendGroup
} from 'c/erDiagramLogic';

describe('parseEr', () => {
    it('parses a single entity with plain fields', () => {
        const model = parseEr('entity Account : Name, Industry');
        expect(model.entities).toHaveLength(1);
        expect(model.entities[0].name).toBe('Account');
        expect(model.entities[0].fields.map((f) => f.name)).toEqual(['Name', 'Industry']);
    });

    it('parses Master-Detail, Lookup, and Polymorphic relationships with the correct kind', () => {
        const model = parseEr(
            'entity Account : Name\n' +
            'entity Contact : LastName\n' +
            'Contact.AccountId => Account\n' +
            'Contact.OwnerId -> User\n' +
            'Task.WhoId ~> Contact'
        );
        const rels = model.relationships;
        expect(rels.find((r) => r.childField === 'AccountId').kind).toBe('master');
        expect(rels.find((r) => r.childField === 'OwnerId').kind).toBe('lookup');
        expect(rels.find((r) => r.childField === 'WhoId').kind).toBe('poly');
    });

    it('auto-creates an implicit parent entity referenced but never declared', () => {
        const model = parseEr('Contact.OwnerId -> User');
        expect(model.entities.some((e) => e.name === 'User')).toBe(true);
    });

    it('merges entities referenced with different casing, keeping first-seen casing', () => {
        const model = parseEr('entity Account : Name\nentity account : Industry\nContact.AccountId => ACCOUNT');
        const account = model.entities.find((e) => e.name.toLowerCase() === 'account');
        expect(account.name).toBe('Account');
        expect(account.fields.map((f) => f.name)).toEqual(expect.arrayContaining(['Name', 'Industry']));
        expect(model.entities.filter((e) => e.name.toLowerCase() === 'account')).toHaveLength(1);
    });

    it('dedupes an exact duplicate relationship line instead of drawing it twice', () => {
        const model = parseEr('entity Contact : Name\nContact.AccountId => Account\nContact.AccountId => Account');
        expect(model.relationships).toHaveLength(1);
    });

    it('records every target for a genuinely polymorphic single field', () => {
        const model = parseEr('entity Task : Subject\nTask.WhoId ~> Contact\nTask.WhoId ~> Lead');
        const task = model.entities.find((e) => e.name === 'Task');
        const whoId = task.fields.find((f) => f.name === 'WhoId');
        expect(whoId.relatesTo).toEqual(['Contact', 'Lead']);
        expect(model.relationships).toHaveLength(2);
    });

    it('skips a redundant explicit "Id" in a field list instead of duplicating the PK row', () => {
        const model = parseEr('entity Account : Id, Name');
        const account = model.entities.find((e) => e.name === 'Account');
        expect(account.fields.some((f) => f.name.toLowerCase() === 'id')).toBe(false);
    });

    it('parses a "[rollup]" suffix as a Roll-Up Summary marker, stripping it from the field name', () => {
        const model = parseEr('entity WebCart : Name, TotalProductAmount[rollup]');
        const cart = model.entities.find((e) => e.name === 'WebCart');
        const total = cart.fields.find((f) => f.name === 'TotalProductAmount');
        expect(total).toBeDefined();
        expect(total.isRollupSummary).toBe(true);
        const plain = cart.fields.find((f) => f.name === 'Name');
        expect(plain.isRollupSummary).toBe(false);
    });

    it('"[rollup]" marker is case-insensitive and tolerates internal whitespace', () => {
        const model = parseEr('entity WebCart : TotalProductAmount[ RollUp ]');
        const field = model.entities[0].fields[0];
        expect(field.name).toBe('TotalProductAmount');
        expect(field.isRollupSummary).toBe(true);
    });

    it('a field with no "[rollup]" suffix is not marked as a Roll-Up Summary', () => {
        const model = parseEr('entity Account : Name');
        expect(model.entities[0].fields[0].isRollupSummary).toBe(false);
    });

    it('the "[rollup]" marker is entirely optional — DSL saved before it existed still parses identically', () => {
        const model = parseEr('entity Account : Name, Industry, Phone');
        expect(model.entities[0].fields.every((f) => f.isRollupSummary === false)).toBe(true);
    });

    it('parses a bracket suffix that is not "rollup" as a data type label instead', () => {
        const model = parseEr('entity Account : Name[Text], AnnualRevenue[Currency]');
        const name = model.entities[0].fields.find((f) => f.name === 'Name');
        const revenue = model.entities[0].fields.find((f) => f.name === 'AnnualRevenue');
        expect(name.dataType).toBe('Text');
        expect(name.isRollupSummary).toBe(false);
        expect(revenue.dataType).toBe('Currency');
    });

    it('a data type label can contain spaces and its own parentheses — only the outermost brackets matter', () => {
        const model = parseEr('entity Account : Description[Text Area (Long)]');
        expect(model.entities[0].fields[0].dataType).toBe('Text Area (Long)');
    });

    it('a field with no bracket at all has a null data type, not an empty string or a crash', () => {
        const model = parseEr('entity Account : Name');
        expect(model.entities[0].fields[0].dataType).toBeNull();
    });

    it('throws a helpful error naming the line number for unrecognized syntax', () => {
        expect(() => parseEr('entity Account : Name\nthis is not valid DSL')).toThrow(/Line 2/);
    });

    it('throws for empty input rather than silently returning nothing', () => {
        expect(() => parseEr('')).toThrow(/No entities found/);
    });

    it('parses the bundled ER_SAMPLE without error', () => {
        expect(() => parseEr(ER_SAMPLE)).not.toThrow();
    });
});

describe('buildErGeometry', () => {
    it('lays out one box per entity with positive dimensions', () => {
        const model = parseEr('entity Account : Name\nentity Contact : LastName\nContact.AccountId => Account');
        const geo = buildErGeometry(model, {}, {}, {});
        expect(geo.boxes).toHaveLength(2);
        geo.boxes.forEach((b) => {
            expect(b.width).toBeGreaterThan(0);
            expect(b.height).toBeGreaterThan(0);
        });
        expect(geo.svgWidth).toBeGreaterThan(0);
        expect(geo.svgHeight).toBeGreaterThan(0);
    });

    it('propagates isRollupSummary from the parsed model through to the rendered field rows', () => {
        const model = parseEr('entity WebCart : Name, TotalProductAmount[rollup]');
        const geo = buildErGeometry(model, {}, {}, {});
        const cartBox = geo.boxes.find((b) => b.name === 'WebCart');
        const idRow = cartBox.fields.find((f) => f.text === 'Id');
        const nameRow = cartBox.fields.find((f) => f.text === 'Name');
        const rollupRow = cartBox.fields.find((f) => f.text === 'TotalProductAmount');
        expect(idRow.isRollupSummary).toBe(false);
        expect(nameRow.isRollupSummary).toBe(false);
        expect(rollupRow.isRollupSummary).toBe(true);
    });

    it('reuses a saved position instead of recomputing the default grid slot', () => {
        const model = parseEr('entity Account : Name');
        const geo = buildErGeometry(model, { Account: { x: 500, y: 400 } }, {}, {});
        expect(geo.boxes[0].x).toBe(500);
        expect(geo.boxes[0].y).toBe(400);
    });

    it('renders a self-relationship as a curved loop, not a degenerate zero-length line', () => {
        const model = parseEr('entity Account : Name\nAccount.ParentId -> Account');
        const geo = buildErGeometry(model, {}, {}, {});
        expect(geo.connectors).toHaveLength(1);
        expect(geo.connectors[0].d).toMatch(/^M .* C /);
    });

    it('fans out multiple relationships between the same pair of entities instead of overlapping them', () => {
        const model = parseEr(
            'entity Opportunity : Name\nentity Account : Name\n' +
            'Opportunity.AccountId -> Account\nOpportunity.Primary_Partner__c -> Account'
        );
        const geo = buildErGeometry(model, {}, {}, {});
        expect(geo.connectors).toHaveLength(2);
        expect(geo.connectors[0].d).not.toBe(geo.connectors[1].d);
    });

    it('tags each connector with its child/parent entity names for canvas features (Focus mode, badges)', () => {
        const model = parseEr('entity Account : Name\nentity Contact : LastName\nContact.AccountId => Account');
        const geo = buildErGeometry(model, {}, {}, {});
        expect(geo.connectors[0].childEntity).toBe('Contact');
        expect(geo.connectors[0].parentEntity).toBe('Account');
    });
});

describe('buildMermaidErDiagram', () => {
    it('generates a valid erDiagram block with correctly quoted relationship labels', () => {
        const model = parseEr('entity Account : Name\nentity Contact : LastName\nContact.AccountId => Account');
        const mmd = buildMermaidErDiagram(model);
        expect(mmd).toMatch(/^erDiagram/);
        expect(mmd).toContain('Account ||--o{ Contact : "AccountId (Master-Detail)"');
    });

    it('uses a dashed (non-identifying) line for Lookup and Polymorphic, solid for Master-Detail', () => {
        const model = parseEr('entity Account : Name\nentity Contact : LastName\nContact.OwnerId -> User');
        const mmd = buildMermaidErDiagram(model);
        expect(mmd).toContain('||..o{'); // Lookup -> dashed
    });

    it('marks the primary key and foreign key rows in the entity attribute block', () => {
        const model = parseEr('entity Account : Name\nentity Contact : LastName\nContact.AccountId => Account');
        const mmd = buildMermaidErDiagram(model);
        expect(mmd).toContain('id Id PK');
        expect(mmd).toContain('reference AccountId FK');
    });
});

describe('buildDrawioXml', () => {
    it('produces one vertex per entity and one edge per relationship', () => {
        const model = parseEr('entity Account : Name\nentity Contact : LastName\nContact.AccountId => Account');
        const geo = buildErGeometry(model, {}, {}, {});
        const xml = buildDrawioXml(model, geo.boxes);
        expect((xml.match(/vertex="1"/g) || [])).toHaveLength(2);
        expect((xml.match(/edge="1"/g) || [])).toHaveLength(1);
    });

    it('reuses the actual computed canvas position rather than a default', () => {
        const model = parseEr('entity Account : Name');
        const geo = buildErGeometry(model, {}, {}, {});
        const xml = buildDrawioXml(model, geo.boxes);
        const account = geo.boxes.find((b) => b.name === 'Account');
        expect(xml).toContain(`x="${Math.round(account.x)}" y="${Math.round(account.y)}"`);
    });

    it('gives a self-relationship the same source and target node id', () => {
        const model = parseEr('entity Account : Name\nAccount.ParentId -> Account');
        const geo = buildErGeometry(model, {}, {}, {});
        const xml = buildDrawioXml(model, geo.boxes);
        const match = xml.match(/source="(n\d+)"[^>]*target="(n\d+)"/);
        expect(match[1]).toBe(match[2]);
    });
});

describe('buildLegendGroup', () => {
    it('returns an SVG <g> element containing the three relationship rows', () => {
        const g = buildLegendGroup(800, 600);
        expect(g.tagName.toLowerCase()).toBe('g');
        expect(g.querySelectorAll('text').length).toBeGreaterThanOrEqual(4); // title + 3 rows
    });
});
