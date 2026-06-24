# Run from PC after adding public key to Hostinger SSH Access.
# Usage: .\scripts\run-remote-setup.ps1

$ErrorActionPreference = "Stop"
$HostKey = "153.92.9.220"
$Port = "65002"
$User = "u826622735"
$Key = "$env:USERPROFILE\.ssh\deliverex_hostinger"

if (-not (Test-Path $Key)) {
    Write-Host "Generating SSH key..."
    ssh-keygen -t ed25519 -C "deliverex-deploy" -f $Key -N '""'
    Write-Host ""
    Write-Host "ADD THIS PUBLIC KEY to hPanel -> SSH Access -> Add SSH key:"
    Write-Host "----------------------------------------------------------------"
    Get-Content "$Key.pub"
    Write-Host "----------------------------------------------------------------"
    Write-Host "Then run this script again."
    exit 1
}

$remote = @"
curl -fsSL https://raw.githubusercontent.com/taduranmiggy/deliverex/main/scripts/hostinger-one-shot-setup.sh | bash
"@

ssh -i $Key -p $Port -o StrictHostKeyChecking=no "${User}@${HostKey}" $remote
