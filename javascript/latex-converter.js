function convertLatexToUnicode(text) {
    // Basic superscript conversion
    const superscriptMap = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
        'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ'
    };
    
    // Basic subscript conversion
    const subscriptMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
        '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
        'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
        'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
        'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
        'v': 'ᵥ', 'x': 'ₓ'
    };
    
    // Greek letters and symbols
    const symbolMap = {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
        '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
        '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
        '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
        '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
        '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
        '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
        '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ',
        '\\Psi': 'Ψ', '\\Omega': 'Ω',
        '\\infty': '∞', '\\pm': '±', '\\mp': '∓',
        '\\times': '×', '\\div': '÷', '\\cdot': '·',
        '\\leq': '≤', '\\geq': '≥', '\\neq': '≠',
        '\\approx': '≈', '\\equiv': '≡', '\\propto': '∝',
        '\\subset': '⊂', '\\supset': '⊃', '\\in': '∈',
        '\\notin': '∉', '\\cup': '∪', '\\cap': '∩',
        '\\sum': '∑', '\\prod': '∏', '\\int': '∫',
        '\\sqrt': '√', '\\partial': '∂', '\\nabla': '∇'
    };
    
    const urlRegex = /https?:\/\/[^\s)]+/g;
    const urlPlaceholder = 'URLPROTECTED'; 
    let urlMap = new Map();
    let placeholderIndex = 0;

    let result = text.replace(urlRegex, (url) => {
        const placeholder = `${urlPlaceholder}${placeholderIndex++}`;
        urlMap.set(placeholder, url);
        return placeholder;
    });

    // Convert LaTeX tables to HTML tables
    result = convertLatexTables(result);
    
    // Also handle simple markdown-style tables
    result = convertMarkdownTables(result);

    // Convert LaTeX text formatting
    result = result.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
    result = result.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
    result = result.replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>');

    // Convert markdown-style formatting
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // **bold**
    result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>'); // *italic*
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>'); // `code`
    result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>'); // ~~strikethrough~~

    for (const [latex, unicode] of Object.entries(symbolMap)) {
        result = result.replace(new RegExp(latex.replace('\\', '\\\\'), 'g'), unicode);
    }
    
    result = result.replace(/\^{([^}]+)}/g, (match, content) => {
        return content.split('').map(char => superscriptMap[char] || char).join('');
    });
    result = result.replace(/\^([a-zA-Z0-9+\-=()])/g, (match, char) => {
        return superscriptMap[char] || char;
    });
    
    result = result.replace(/_{([^}]+)}/g, (match, content) => {
        return content.split('').map(char => subscriptMap[char] || char).join('');
    });
    result = result.replace(/_([a-zA-Z0-9+\-=()])/g, (match, char) => {
        return subscriptMap[char] || char;
    });
    
    // Restore URLs as clickable links
    for (const [placeholder, url] of urlMap) {
        result = result.replace(new RegExp(placeholder, 'g'), `<a href="${url}" target="_blank">${url}</a>`);
    }
    
    return result;
}

function convertLatexTables(text) {
    // Match table patterns - look for multiple lines with | characters
    const tableRegex = /(?:^\s*\|[^\n]*\|\s*$\n?){2,}/gm;
    
    return text.replace(tableRegex, (match) => {
        // Skip citation tables
        if (/source|college physics|chapter|page/i.test(match)) return '';
        // Split into rows and clean them up
        const rows = match.split('\n')
            .map(row => row.trim())
            .filter(row => row && row.includes('|'));
        
        if (rows.length === 0) return match;
        
        let html = '<table>';
        let headerProcessed = false;
        
        rows.forEach((row, index) => {
            // Clean up the row and split by |
            const cells = row.split('|')
                .map(cell => cell.trim())
                .filter(cell => cell !== '');
            
            if (cells.length === 0) return;
            
            // Check if this is a separator row (contains only dashes, colons, and spaces)
            const isSeparator = cells.every(cell => /^[\s\-:]+$/.test(cell));
            if (isSeparator) return;
            
            // Determine if this is a header row
            const isHeader = !headerProcessed;
            if (isHeader) headerProcessed = true;
            
            const tag = isHeader ? 'th' : 'td';
            
            html += '<tr>';
            cells.forEach(cell => {
                // Process LaTeX symbols in cell content
                let processedCell = cell;
                
                // Apply symbol conversions
                for (const [latex, unicode] of Object.entries(symbolMap)) {
                    processedCell = processedCell.replace(new RegExp(latex.replace('\\', '\\\\'), 'g'), unicode);
                }
                
                // Handle bold text
                processedCell = processedCell.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                
                html += `<${tag}>${processedCell}</${tag}>`;
            });
            html += '</tr>';
        });
        
        html += '</table>';
        return html;
    });
}

function convertMarkdownTables(text) {
    // Strip citation tables before processing
    text = text.replace(/(?:\|[^\n]*(?:source|college physics|chapter|page)[^\n]*\|?\n?)+/gi, '');
    const lines = text.split('\n');
    const tableLines = [];
    let inTable = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if line looks like a table row
        if (line.includes('|') && line.split('|').length >= 3) {
            if (!inTable) {
                inTable = true;
                tableLines.length = 0; // Reset for new table
            }
            tableLines.push(line);
        } else if (inTable && tableLines.length > 0) {
            // End of table, process it
            const tableHtml = processTableLines(tableLines);
            text = text.replace(tableLines.join('\n'), tableHtml);
            inTable = false;
            tableLines.length = 0;
        }
    }
    
    // Handle table at end of text
    if (inTable && tableLines.length > 0) {
        const tableHtml = processTableLines(tableLines);
        text = text.replace(tableLines.join('\n'), tableHtml);
    }
    
    return text;
}

function processTableLines(lines) {
    if (lines.length === 0) return '';
    
    const symbolMap = {
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
        '\\pi': 'π', '\\sigma': 'σ', '\\mu': 'μ', '\\lambda': 'λ'
    };
    
    let html = '<table>';
    
    lines.forEach((line, index) => {
        const cells = line.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell !== '');
        
        if (cells.length === 0) return;
        
        // Check if this is a separator row
        const isSeparator = cells.every(cell => /^[\s\-:]+$/.test(cell));
        if (isSeparator) return;
        
        // First non-separator row is header
        const isHeader = index === 0;
        const tag = isHeader ? 'th' : 'td';
        
        html += '<tr>';
        cells.forEach(cell => {
            // Process LaTeX symbols and formatting
            let processedCell = cell;
            
            // Apply symbol conversions
            for (const [latex, unicode] of Object.entries(symbolMap)) {
                processedCell = processedCell.replace(new RegExp(latex.replace('\\', '\\\\'), 'g'), unicode);
            }
            
            // Handle bold text
            processedCell = processedCell.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            
            html += `<${tag}>${processedCell}</${tag}>`;
        });
        html += '</tr>';
    });
    
    html += '</table>';
    return html;
}

window.convertLatexToUnicode = convertLatexToUnicode;
window.convertLatexTables = convertLatexTables;
window.convertMarkdownTables = convertMarkdownTables;