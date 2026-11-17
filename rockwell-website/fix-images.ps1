# ============================================================
# Rockwell Website — Remove favicons + replace img with elegant placeholders
# ============================================================

$root = "c:\Users\martq\Documents\ockwell_website\rockwell-website"

# ── 1. Remove favicon link from ALL HTML files ──────────────
$htmlFiles = Get-ChildItem $root -Recurse -Include "*.html"
foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $updated = $content -replace '\s*<!-- Favicon -->\s*\r?\n\s*<link rel="icon"[^>]+/>\s*\r?\n', "`n"
    if ($updated -ne $content) {
        Set-Content $file.FullName $updated -NoNewline
        Write-Host "✅ Favicon removed: $($file.Name)"
    }
}

Write-Host ""
Write-Host "──────────────────────────────────────────"
Write-Host "Favicon done. Now replacing img tags..."
Write-Host "──────────────────────────────────────────"
Write-Host ""

# ── 2. index.html — Meet Rockwell founder img ───────────────
$indexPath = "$root\index.html"
$indexContent = Get-Content $indexPath -Raw

$oldFounderImg = @'
              <img
                src="assets/images/founder-placeholder.svg"
                alt="Fritzie Ann Silva — Founder of Rockwell Tax &amp; Digital Strategies Inc. Official portrait placement"
                class="meet-rockwell__img"
                width="420"
                height="525"
                loading="lazy"
              />
'@

$newFounderPlaceholder = @'
              <div class="meet-rockwell__img img-placeholder" role="img" aria-label="Fritzie Ann Silva — Founder of Rockwell Tax &amp; Digital Strategies Inc.">
                <div class="placeholder-content">
                  <span class="placeholder-title">Fritzie Ann Silva</span>
                  <span class="placeholder-sub">Founder photograph<br>pending client approval</span>
                </div>
              </div>
'@

if ($indexContent.Contains($oldFounderImg.Trim().Substring(0,30))) {
    $indexContent = $indexContent.Replace($oldFounderImg, $newFounderPlaceholder)
    Set-Content $indexPath $indexContent -NoNewline
    Write-Host "✅ index.html — Meet Rockwell founder img replaced"
} else {
    Write-Host "⚠️  index.html — Meet Rockwell img pattern not found (may already be replaced)"
}

# ── 3. bookkeeping.html — bk-why photo ─────────────────────
$bkPath = "$root\pages\bookkeeping\bookkeeping.html"
$bkContent = Get-Content $bkPath -Raw

$oldBkImg = @'
            <img
              src="../../assets/images/business-review.jpg"
              alt="Business owner reviewing financial records, ledger sheets, and calculator"
              class="bk-why__photo"
              width="520"
              height="390"
              loading="lazy"
            />
'@

$newBkPlaceholder = @'
            <div class="bk-why__photo img-placeholder" role="img" aria-label="Business owner reviewing financial records">
              <div class="placeholder-content">
                <span class="placeholder-title">Bookkeeping</span>
                <span class="placeholder-sub">Client photo coming soon</span>
              </div>
            </div>
'@

if ($bkContent.Contains("bk-why__photo")) {
    $bkContent = $bkContent -replace '(?s)<img\s+src="../../assets/images/business-review\.jpg".*?/>', $newBkPlaceholder.Trim()
    Set-Content $bkPath $bkContent -NoNewline
    Write-Host "✅ bookkeeping.html — bk-why photo replaced"
} else {
    Write-Host "⚠️  bookkeeping.html — bk-why__photo not found"
}

# ── 4. digital-services.html — hero + audience photos ───────
$dsPath = "$root\pages\digital-services\digital-services.html"
$dsContent = Get-Content $dsPath -Raw

$newDsHeroPlaceholder = @'
          <div class="ds-hero__photo img-placeholder" role="img" aria-label="Digital content creator planning marketing strategy">
            <div class="placeholder-content">
              <span class="placeholder-title">Digital Services</span>
              <span class="placeholder-sub">Client photo coming soon</span>
            </div>
          </div>
'@

$newDsAudiencePlaceholder = @'
            <div class="ds-audience__photo img-placeholder" role="img" aria-label="Small business owner planning digital content and marketing">
              <div class="placeholder-content">
                <span class="placeholder-title">Digital Marketing</span>
                <span class="placeholder-sub">Client photo coming soon</span>
              </div>
            </div>
'@

# Replace hero img
$dsContent = $dsContent -replace '(?s)<img\s+src="../../assets/images/digital-marketing\.jpg".*?/>', $newDsHeroPlaceholder.Trim()
# Replace audience img
$dsContent = $dsContent -replace '(?s)<img\s+src="../../assets/images/digital-content\.jpg".*?/>', $newDsAudiencePlaceholder.Trim()

Set-Content $dsPath $dsContent -NoNewline
Write-Host "✅ digital-services.html — hero + audience photos replaced"

# ── 5. about.html — founder photo ───────────────────────────
$aboutPath = "$root\pages\about\about.html"
$aboutContent = Get-Content $aboutPath -Raw

$newAboutPlaceholder = @'
              <div class="about-story__photo-img img-placeholder" role="img" aria-label="Fritzie Ann Silva — Founder of Rockwell Tax &amp; Digital Strategies Inc.">
                <div class="placeholder-content">
                  <span class="placeholder-title">Fritzie Ann Silva</span>
                  <span class="placeholder-sub">Official portrait<br>pending client approval</span>
                </div>
              </div>
'@

$aboutContent = $aboutContent -replace '(?s)<img\s+src="../../assets/images/founder-placeholder\.svg".*?/>', $newAboutPlaceholder.Trim()
Set-Content $aboutPath $aboutContent -NoNewline
Write-Host "✅ about.html — founder photo replaced"

Write-Host ""
Write-Host "============================================"
Write-Host "All done! Verifying no stray img tags remain"
Write-Host "(excluding services.html)..."
Write-Host "============================================"

# ── 6. Verify — find any remaining <img tags (excluding services.html) ──
$remaining = Get-ChildItem $root -Recurse -Include "*.html" | Where-Object { $_.FullName -notlike "*services.html" } | ForEach-Object {
    $c = Get-Content $_.FullName -Raw
    if ($c -match '<img\s') {
        $_.Name
    }
}

if ($remaining) {
    Write-Host "⚠️  Still has <img> tags: $($remaining -join ', ')"
} else {
    Write-Host "✅ No stray <img> tags found in non-services pages!"
}
