param([Parameter(Mandatory=$true)][string]$Subscription,[Parameter(Mandatory=$true)][string]$AssetsDirectory,[string]$Account='saceos02',[string]$Container='ceos-files',[switch]$UseSharedKey)
$ErrorActionPreference='Stop'
$names=@('logo.png','image.png','funcao-png.png','analisecombinatoria.png','estatistica.png','financeiro.png','cinetica.jpg','dinamica.png','energia.png','estequiometria.png','concentracao.png','termoquimica.png')
$mode=if($UseSharedKey){'key'}else{'login'}
foreach($name in $names){
  $file=Join-Path ([IO.Path]::GetFullPath($AssetsDirectory)) $name
  if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw 'Approved image is missing'}
  $exists=az storage blob exists --subscription $Subscription --account-name $Account --container-name $Container --name $name --auth-mode $mode --query exists -o tsv --only-show-errors
  if($LASTEXITCODE -ne 0){throw 'Cannot inspect destination; no upload attempted'}
  if($exists.Trim() -eq 'true'){Write-Output ('Preserved existing '+$name);continue}
  $mime=if($name.EndsWith('.jpg')){'image/jpeg'}else{'image/png'}
  az storage blob upload --subscription $Subscription --account-name $Account --container-name $Container --name $name --file $file --auth-mode $mode --overwrite false --content-type $mime --only-show-errors --output none
  if($LASTEXITCODE -ne 0){throw 'Image upload failed'}
  Write-Output ('Uploaded '+$name)
}
