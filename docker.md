# Create a docker image from this git

You need a Linux with Docker CE installed. Once your changes are pushed to this github, create a new docker image in the 
public Docker Hub like below (make sure you first logged in with `sudo docker login`)
```
sudo docker build https://github.com/ChristofSchwarz/qseok_sso_oidc.git -t qristof/sso4serrala:latest
# this is the imgage id
sudo docker images qristof/sso4serrala:latest -q
sudo docker push qristof/sso4serrala:latest 
```
To run the new image from Docker Hub:
```
sudo docker run -p 3000:3000 qristof/sso4serrala
```

