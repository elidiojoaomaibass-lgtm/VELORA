# Fix DocumentacaoView.tsx
$content = Get-Content 'src\components\DocumentacaoView.tsx' -Raw
$content = $content -replace 'bg-violet-600 text-white', 'bg-slate-800 text-white'
$content = $content -replace 'text-violet-600 dark:text-violet-400 font-mono', 'text-slate-700 dark:text-slate-300 font-mono'
$content = $content -replace 'text-violet-600 dark:text-violet-400', 'text-slate-700 dark:text-slate-300'
$content = $content -replace 'bg-violet-50 dark:bg-violet-950/40', 'bg-slate-100 dark:bg-slate-800/40'
$content = $content -replace 'text-violet-500 uppercase', 'text-slate-500 uppercase'
$content = $content -replace 'text-violet-500', 'text-slate-500'
$content = $content -replace 'bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/20', 'bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-700/20'
$content = $content -replace 'text-violet-900 dark:text-violet-200', 'text-slate-900 dark:text-slate-200'
$content = $content -replace 'dark:bg-violet-900/20 rounded-xl p-3 text-center border border-violet-100 dark:border-violet-800/20', 'dark:bg-slate-800/20 rounded-xl p-3 text-center border border-slate-100 dark:border-slate-700/20'
$content = $content -replace 'text-violet-700 dark:text-violet-300', 'text-slate-700 dark:text-slate-300'
$content = $content -replace 'from-violet-600 to-indigo-700', 'from-slate-800 to-slate-900'
$content = $content -replace 'shadow-violet-500/20', 'shadow-black/20'
$content = $content -replace 'text-violet-100', 'text-slate-200'
$content = $content -replace 'text-violet-900', 'text-slate-900'
$content | Set-Content 'src\components\DocumentacaoView.tsx' -Encoding UTF8
Write-Host "DocumentacaoView.tsx fixed"

# Fix B2CConfigView.tsx
$content = Get-Content 'src\components\B2CConfigView.tsx' -Raw
$content = $content -replace 'from-violet-500 to-purple-600', 'from-slate-600 to-slate-800'
$content = $content -replace 'from-violet-500 to-purple-700', 'from-slate-600 to-slate-800'
$content = $content -replace 'from-violet-600 to-purple-700', 'from-slate-700 to-slate-900'
$content = $content -replace 'bg-violet-600/10', 'bg-slate-600/10'
$content = $content -replace 'shadow-violet-500/30', 'shadow-black/30'
$content = $content -replace 'shadow-violet-500/40', 'shadow-black/40'
$content = $content -replace 'bg-violet-500/5 border border-violet-500/20', 'bg-slate-500/5 border border-slate-500/20'
$content = $content -replace 'text-violet-400', 'text-slate-400'
$content = $content -replace 'text-violet-300', 'text-slate-300'
$content = $content -replace 'focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/25', 'focus:border-slate-500/60 focus:ring-1 focus:ring-slate-500/25'
$content | Set-Content 'src\components\B2CConfigView.tsx' -Encoding UTF8
Write-Host "B2CConfigView.tsx fixed"

# Fix SaqueView.tsx residual
$content = Get-Content 'src\components\SaqueView.tsx' -Raw
$content = $content -replace 'dark:hover:bg-violet-950/40', 'dark:hover:bg-slate-800/40'
$content | Set-Content 'src\components\SaqueView.tsx' -Encoding UTF8
Write-Host "SaqueView.tsx fixed"

Write-Host "All done!"
