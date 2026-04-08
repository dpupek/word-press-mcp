[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('VerifyAuth', 'GetPost', 'UploadMedia', 'SetFeaturedImage')]
    [string]$Action,

    [int]$PostId,

    [string]$FilePath,

    [int]$MediaId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Get-WpConfig {
    $siteUrl = if ($env:WP_SITE_URL) { $env:WP_SITE_URL.TrimEnd('/') } else { 'https://nexportsolutions.com' }
    if (-not $env:WP_USERNAME) {
        throw 'WP_USERNAME is not set in the current shell.'
    }
    if (-not $env:WP_APP_PASSWORD) {
        throw 'WP_APP_PASSWORD is not set in the current shell.'
    }

    $pair = '{0}:{1}' -f $env:WP_USERNAME, $env:WP_APP_PASSWORD
    $token = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))

    return @{
        SiteUrl = $siteUrl
        Headers = @{ Authorization = "Basic $token" }
    }
}

function Invoke-WpJson {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [ValidateSet('Get', 'Post')]
        [string]$Method = 'Get',

        [object]$Body,

        [string]$ContentType,

        [string]$InFile,

        [hashtable]$Headers
    )

    $invokeSplat = @{
        Uri     = $Uri
        Method  = $Method
        Headers = $Headers
    }

    if ($PSBoundParameters.ContainsKey('Body')) {
        $invokeSplat.Body = $Body
    }
    if ($PSBoundParameters.ContainsKey('ContentType')) {
        $invokeSplat.ContentType = $ContentType
    }
    if ($PSBoundParameters.ContainsKey('InFile')) {
        $invokeSplat.InFile = $InFile
    }

    Invoke-RestMethod @invokeSplat
}

$config = Get-WpConfig
$siteUrl = $config.SiteUrl
$headers = $config.Headers

switch ($Action) {
    'VerifyAuth' {
        $result = Invoke-WpJson -Uri "$siteUrl/wp-json/wp/v2/users/me?context=edit" -Headers $headers
        [pscustomobject]@{
            SiteUrl = $siteUrl
            UserId = $result.id
            Username = $result.slug
            Roles = ($result.roles -join ', ')
        } | ConvertTo-Json -Depth 5
        break
    }

    'GetPost' {
        if (-not $PostId) {
            throw 'PostId is required for GetPost.'
        }

        $result = Invoke-WpJson -Uri "$siteUrl/wp-json/wp/v2/posts/$PostId?context=edit" -Headers $headers
        $sectionCount = 0
        $headings = @()

        if ($result.meta._elementor_data) {
            $elementorData = $result.meta._elementor_data | ConvertFrom-Json -Depth 50
            if ($elementorData.Count -gt 0 -and $elementorData[0].elements) {
                $sectionCount = ($elementorData[0].elements | Measure-Object).Count
                $headings = $elementorData[0].elements | ForEach-Object {
                    if ($_.elements.Count -gt 0) { $_.elements[0].settings.title }
                }
            }
        }

        [pscustomobject]@{
            Id = $result.id
            Status = $result.status
            Title = $result.title.raw
            Template = $result.template
            FeaturedMedia = $result.featured_media
            SectionCount = $sectionCount
            Headings = $headings
            EditUrl = "$siteUrl/wp-admin/post.php?post=$($result.id)&action=edit"
            PreviewUrl = "$siteUrl/?p=$($result.id)&preview=true"
        } | ConvertTo-Json -Depth 10
        break
    }

    'UploadMedia' {
        if (-not $FilePath) {
            throw 'FilePath is required for UploadMedia.'
        }
        if (-not (Test-Path -LiteralPath $FilePath)) {
            throw "File not found: $FilePath"
        }

        $fileName = [IO.Path]::GetFileName($FilePath)
        $extension = [IO.Path]::GetExtension($fileName).ToLowerInvariant()
        $contentType = switch ($extension) {
            '.png' { 'image/png' }
            '.jpg' { 'image/jpeg' }
            '.jpeg' { 'image/jpeg' }
            '.webp' { 'image/webp' }
            default { 'application/octet-stream' }
        }

        $mediaHeaders = @{
            Authorization = $headers.Authorization
            'Content-Disposition' = "attachment; filename=""$fileName"""
        }

        $result = Invoke-WpJson -Uri "$siteUrl/wp-json/wp/v2/media" -Method Post -Headers $mediaHeaders -InFile $FilePath -ContentType $contentType
        $absoluteUrl = if ($result.source_url -match '^https?://') { $result.source_url } else { "$siteUrl$($result.source_url)" }

        [pscustomobject]@{
            MediaId = $result.id
            FileName = $fileName
            SourceUrl = $absoluteUrl
        } | ConvertTo-Json -Depth 5
        break
    }

    'SetFeaturedImage' {
        if (-not $PostId) {
            throw 'PostId is required for SetFeaturedImage.'
        }
        if (-not $MediaId) {
            throw 'MediaId is required for SetFeaturedImage.'
        }

        $body = @{ featured_media = $MediaId } | ConvertTo-Json
        $result = Invoke-WpJson -Uri "$siteUrl/wp-json/wp/v2/posts/$PostId" -Method Post -Headers $headers -Body $body -ContentType 'application/json'

        [pscustomobject]@{
            PostId = $result.id
            FeaturedMedia = $result.featured_media
            EditUrl = "$siteUrl/wp-admin/post.php?post=$($result.id)&action=edit"
            PreviewUrl = "$siteUrl/?p=$($result.id)&preview=true"
        } | ConvertTo-Json -Depth 5
        break
    }
}
