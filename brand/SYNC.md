# Synchroniser les chartes

`scripts/sync-brands.py` relit les quatre sources et met à jour `brand/<marque>/`.

Il remplace un fichier seulement si le commit, les pointes de branches, les variables CSS extraites ou l’empreinte d’un asset a changé. Une deuxième exécution sans changement en amont ne modifie rien. Le positionnement, la voix et les textes du studio restent ceux du manifeste.

## Sources

| Marque | Dépôt | Branche lue | Repli |
| --- | --- | --- | --- |
| Proplace | `proplace-co/proplace-co.github.io` | défaut (`main`) | — |
| Maximum Insurance | `proplace-co/maximum-insurance` | `sauvegarde/auto/maximum-insurance-main/branches/feature/mi-design` | aucun pour les jetons : le site public est encore la V5 |

Maximum : la branche ci-dessus est la source git (HEAD connu `1acd318`). Le build du site v6 (`assets/site/`, `docs/site-v6/`, `site_build.py`) n’y est pas encore commité. Tant que ces fichiers n’y sont pas, le script ne remplace pas les jetons `--mx-*` par le HTML de maximum-insurance.com. Il le fera dès qu’un CSS du site contenant `--mx-` apparaît sur cette branche.
| ProFund | `proplace-co/profund-vc` | défaut (`main`) | — |
| SoSuites | `proplace-co/sosuites` | défaut | `https://www.sosuites.com/` |

Les autres branches sont notées dans `sync.otherBranches` (nom et SHA). Elles ne remplacent pas les jetons, sauf la règle v6 de Maximum.

## Lancer à la main

```bash
python3 scripts/sync-brands.py
```

## Secret GitHub

Le workflow `.github/workflows/sync-brands.yml` tourne chaque jour à 05:15 UTC et peut être lancé à la main. Il ouvre une pull request sur `main` seulement s’il y a un diff.

Les dépôts publics se lisent sans secret. Maximum Insurance et SoSuites sont invisibles sans un jeton (réponse « repository not found »). Tant que le secret n’existe pas, le workflow garde le repli des sites publics et l’écrit dans `sync.notes`.

Créer le secret d’actions du dépôt `proplace-co/wargame` :

- Nom : `BRAND_REPOS_TOKEN`
- Type : fine-grained personal access token, avec un compte qui voit l’organisation `proplace-co`
- Dépôts autorisés, et seulement ceux-là :
  - `proplace-co/proplace-co.github.io`
  - `proplace-co/maximum-insurance`
  - `proplace-co/profund-vc`
  - `proplace-co/sosuites`
- Permissions : Contents **Read-only**, Metadata **Read-only**
- Pas d’écriture, pas d’administration, pas l’accès aux secrets de ces dépôts

Le `GITHUB_TOKEN` du workflow ouvre la pull request dans `wargame`. Il ne sert pas à lire les autres dépôts. Ne pas committer la valeur du jeton.
