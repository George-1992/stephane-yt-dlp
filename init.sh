# install the latest of the following packages
# cors, express, dotenv, helmet, nodemon, playwright, jsonwebtoken, bcryptjs, module-alias
# node-cron, pdfjs-dist

echo "Installing required packages..."

# npm install cors express dotenv helmet nodemon playwright jsonwebtoken bcryptjs module-alias node-cron pdfjs-dist
# npm uninstall cors express dotenv helmet nodemon playwright jsonwebtoken bcryptjs module-alias node-cron pdfjs-dist

# create node_modules if it doesn't exist
mkdir -p node_modules


# # add js config and make sure @ is mapped to src
# echo "Setting up jsconfig.json..."
# cat <<EOL > jsconfig.json
# {
#   "compilerOptions": {
#     "baseUrl": ".",
#     "paths": {
#       "@/*": ["src/*"]
#     }
#   },
#   "include": ["src"]
# }
# EOL