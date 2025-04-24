var sourceCodeContainer = document.querySelector("#source");
var sizeContainer = document.querySelector("#size");

fetch("../script.js").then(response => {
    return response.text();
}).then(sourceCode => { 
    const options = {
        compress: {
            passes: 3,
            inline: true,
        },
        mangle: true,
        toplevel: true,
    };
    let minified = Terser.minify_sync(sourceCode, options);
    let minifiedCode = minified.code;

    sourceCodeContainer.innerHTML = escapeHTML(minifiedCode);
    hljs.highlightElement(sourceCodeContainer);
    
    let totalSize = minifiedCode.length + getBoilerplateLength();
    sizeContainer.innerHTML = `${totalSize} bytes (${minifiedCode.length} script + ${getBoilerplateLength()} boilerplate)`;
});

function getBoilerplateLength() {
    return "<body style=\"margin:0\"><canvas width=720 height=720><script></script>".length;
}

function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}