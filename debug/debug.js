var sourceCodeContainer = document.querySelector("#source");
var sizeContainer = document.querySelector("#size");

fetch("../script.js").then(response => {
    return response.text();
}).then(sourceCode => { 
    var options = { compress: true, mangle: true, toplevel: true };
    let minified = Terser.minify_sync(sourceCode, options);
    let minifiedCode = minified.code;

    sourceCodeContainer.innerHTML = escapeHTML(minifiedCode);
    sizeContainer.innerHTML = minifiedCode.length;

    hljs.highlightElement(sourceCodeContainer);
});

function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}