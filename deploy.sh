docker stop certificados-polygon-ucv-backend
docker rm certificados-polygon-ucv-backend
docker image rm certificados-polygon-ucv-backend-img:v0
docker build -t certificados-polygon-ucv-backend-img:v0 .
docker run --name certificados-polygon-ucv-backend -p3010:3000 certificados-polygon-ucv-backend-img:v0