class test_element extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        // this.innerHTML = `<p>This is a test element.</p>`;
        
        this.uuid = test_element.id++;
        this.shadow.innerHTML = `<p>This is the ` + this.uuid + `rd test element.</p>`;
        console.log('Test element ' + this.uuid + ' loaded successfully.');
    }
}
test_element.id = 0;
customElements.define('test-element', test_element);