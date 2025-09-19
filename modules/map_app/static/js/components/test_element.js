class test_element extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        // this.innerHTML = `<p>This is a test element.</p>`;
        this.shadow.innerHTML = `<p>This is a test element.</p>`;
        console.log('Test element loaded successfully.');
    }
}
customElements.define('test-element', test_element);