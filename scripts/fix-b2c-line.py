with open('src/components/B2CConfigView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Replace line 816 (index 815) with clean version
lines[815] = '                                        <p className="font-semibold text-rose-300 text-sm mb-1">Payout Real - Atencao</p>\n'

with open('src/components/B2CConfigView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Fixed line 816')
