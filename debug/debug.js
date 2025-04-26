var sourceCodeContainer = document.querySelector("#source");
var sizeContainer = document.querySelector("#size");

fetch("../script.js").then(response => {
    return response.text();
}).then(sourceCode => { 
    const options = {
        compress: {
            passes: 3,
            inline: true,
            toplevel: true,
            ecma: 2020,
            unsafe: true,
            unsafe_arrows: true,
            unsafe_math: true,
            unsafe_Function: true,
            unsafe_comps: true,
        },
        mangle: {
            toplevel: true,
            
        },
        toplevel: true,
    };
    let minified = Terser.minify_sync(sourceCode, options);
    let minifiedCode = minified.code;

    sourceCodeContainer.innerHTML = escapeHTML(minifiedCode);
    hljs.highlightElement(sourceCodeContainer);
    
    let totalSize = minifiedCode.length + getBoilerplateLength();
    sizeContainer.innerHTML = `${totalSize} bytes (${minifiedCode.length} script + ${getBoilerplateLength()} bootstrap)`;
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