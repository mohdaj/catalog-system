##########for dev#####
#docker rm -f catalog-api && image rm catalog-api && build -t catalog-api .
#docker image rm catalog-api &&

#docker buildx create --name mybuilder --use
#docker buildx inspect --bootstrap

###########for prod##################
docker buildx build --platform linux/amd64,linux/arm64 -t mohadaj/catalog-api:latest --push .
##########""""""""""""
