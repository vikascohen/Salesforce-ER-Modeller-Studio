import { createElement } from 'lwc';
import ScannerCoverage from 'c/fieldUsageScannerCoverage';

function render(log, counts = {}) {
    const element = createElement('c-field-usage-scanner-coverage', { is: ScannerCoverage });
    element.progressLog = log;
    element.coverage = ['Apex Class', 'Apex Trigger', 'Flow', 'LWC', 'Aura', 'Validation Rule', 'Formula Field',
        'OmniScript', 'Integration Procedure', 'Omni Data Mapper'].map(name => ({
        name, count: counts[name] || 0, status: counts[name] ? 'Evidence found' : 'No evidence'
    }));
    document.body.appendChild(element);
    return element.shadowRoot;
}

afterEach(() => { document.body.replaceChildren(); });

it('includes one optional scanner when the saved probe finds either standard root', () => {
    const root = render('[Schema coverage] warning\nOmniStudio: OmniProcess, OmniDataTransform', { Flow: 1 });
    expect(root.querySelectorAll('article')).toHaveLength(8);
    expect(root.querySelector('.summary').textContent).toContain('1 of 8');
    expect(root.querySelector('.flow').textContent).toContain('8 discovery sources');
});

it.each(['', 'OmniStudio: no readable standard runtime objects; safely skipped. Managed-package runtime detected;'])(
    'omits unsupported or unrecorded Omni coverage', log => {
        expect(render(log).querySelectorAll('article')).toHaveLength(7);
    }
);

it('groups all three persisted Omni types even in a snapshot without a probe', () => {
    const root = render('', { OmniScript: 2, 'Integration Procedure': 3, 'Omni Data Mapper': 4 });
    expect(root.querySelector('article:last-child').textContent).toContain('9 evidence records');
    expect(root.querySelector('.summary').textContent).toContain('1 of 8');
});
