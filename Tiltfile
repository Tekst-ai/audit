def retraced():
  image = static_build('./Dockerfile.skaffold',
                     'registry.replicated.com/shipretraced/retraced')
  yaml = local('kustomize build ./kustomize/overlays/dev')
  return k8s_service(yaml, image)

