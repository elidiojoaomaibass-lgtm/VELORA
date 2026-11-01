"""
Fix catch blocks that reference 'e' or 'err' in their body but have been stripped of the variable.
Restores them to catch (e: unknown) or catch (err: unknown) as appropriate.
"""
import re
import sys

def fix_catch_blocks(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Pattern: catch { ... body uses 'e' ... }
    # We need to find catch { blocks where the body references standalone 'e' or 'err'
    # Strategy: find all catch { ... } blocks and check if body uses e/err
    
    # Fix catch { ... e. or , e) or (e) etc
    # Simple approach: replace 'catch {' followed (eventually) by body referencing 'e'
    # with 'catch (e: unknown) {'
    
    # Find catch blocks using a state machine approach
    result = []
    i = 0
    while i < len(content):
        # Look for 'catch {'
        m = re.search(r'catch \{', content[i:])
        if not m:
            result.append(content[i:])
            break
        
        start = i + m.start()
        result.append(content[i:start])
        
        # Find the matching closing brace
        brace_start = start + len('catch {')
        depth = 1
        j = brace_start
        while j < len(content) and depth > 0:
            if content[j] == '{':
                depth += 1
            elif content[j] == '}':
                depth -= 1
            j += 1
        
        block_body = content[brace_start:j-1]
        
        # Check if body references 'e' (standalone variable: e., e,, e), console.*(e), etc.)
        # but NOT 'err' (different variable)
        uses_e = bool(re.search(r'\be\b(?!\w)', block_body))
        uses_err = bool(re.search(r'\berr\b', block_body))
        
        if uses_e and not uses_err:
            result.append(f'catch (e: unknown) {{')
        elif uses_err and not uses_e:
            result.append(f'catch (err: unknown) {{')
        else:
            result.append(f'catch {{')
        
        result.append(block_body)
        result.append('}')
        i = j
    
    content = ''.join(result)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed: {filepath}')
    else:
        print(f'No changes: {filepath}')

files = [
    'src/lib/store.ts',
    'src/components/CheckoutModal.tsx',
    'src/components/ConfiguracoesView.tsx',
    'src/components/ProdutosView.tsx',
]

for f in files:
    fix_catch_blocks(f)

print('Done!')
