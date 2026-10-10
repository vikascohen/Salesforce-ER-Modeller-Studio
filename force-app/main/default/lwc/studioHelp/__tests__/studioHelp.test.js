import { createElement } from 'lwc';
import StudioHelp from 'c/studioHelp';

describe('Studio Help configuration navigation', () => {
    afterEach(() => { document.body.innerHTML = ''; });
    it('shows Tooling API help by default and opens a separate MCP configuration section', async () => {
        const element = createElement('c-studio-help', { is: StudioHelp });
        document.body.appendChild(element);
        expect(element.shadowRoot.querySelector('c-tooling-api-configuration-help')).not.toBeNull();
        expect(element.shadowRoot.querySelector('c-mcp-configuration-help')).toBeNull();
        const mcp = [...element.shadowRoot.querySelectorAll('button')].find(button => button.textContent.includes('MCP Server Configuration'));
        expect(mcp).toBeDefined();
        mcp.click();
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('c-mcp-configuration-help')).not.toBeNull();
        expect(element.shadowRoot.querySelector('c-tooling-api-configuration-help')).toBeNull();
        const tooling = [...element.shadowRoot.querySelectorAll('button')].find(button => button.textContent.includes('Field Usage / Tooling API'));
        tooling.click();
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('c-tooling-api-configuration-help')).not.toBeNull();
    });
});
