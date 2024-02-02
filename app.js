const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const fs = require('fs');
const app = express();

const port = 3000;



const redirectUri = 'http://localhost:3000/callback'; // Update the app on azure portal with this callback url
const tenantId = 'xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx';//Update with your tenant ID
const clientId = 'your app id'; 
const clientSecret = 'your client secret';

//some variables to store data
var tokenResponse = "no access token!"
var refreshToken = 'no refresh token';
var extendedToken = 'no extended token yet';
var accessToken = 'no access token';
var error = 'no error';

const tokenfile = fs.readFileSync('token.txt', 'utf8');


// # step 1
// when the app start call this end poit to login
app.get('/login', (req, res) => {
    const authorizeUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=.default offline_access`;//   user.read openid profile 
     
    res.redirect(authorizeUrl);
});

//# step 2 
app.get('/callback', async (req, res) => {
    const { code } = req.query;// we extract the code returned from the server 

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`; 
    const tokenParams = {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',

    };

    try {
        // we xchange authorization code for access token
        tokenResponse = await axios.post(tokenEndpoint, qs.stringify(tokenParams), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        accessToken = tokenResponse.data.access_token;
        refreshToken = tokenResponse.data.refresh_token;
       

        res.redirect('/token');// we just redirect to display the token 
      

    } catch (error) {
        console.error('Error exchanging code for token:', error.message);
        console.error('Error exchanging code for token:', error);
        res.status(500).send('Internal Server Error');
    }
});



app.get('/token', (req, res) => {
    res.json({ 'tokenResponse.data': tokenResponse.data, })
})


// #step 3 
// we request a token with refresh token to get the extended one
app.get('/refresh', async (req, res) => {
    const data = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
       
    }

    await axios.post(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, qs.stringify(data))
        .then(response => {
            console.log(response.data);
            extendedToken = response.data;
            refreshToken = response.data.refresh_token;
            res.redirect('extoken');
        })
        .catch(e => {
            console.error(e);
            error = e;
            res.redirect('/error');
        });

    console.log(error)

})


app.get('/me', async (req, res) => {
    // Now you can use the accessToken to make requests to Microsoft Graph API
    // For example, fetching user information
    const userEndpoint = 'https://graph.microsoft.com/v1.0/me';
    const userResponse = await axios.get(userEndpoint, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const userInfo = userResponse.data;
    res.json(userInfo);

})
app.get('/error', (req, res) => {
    res.json(error)
})

app.get('/extoken', (req, res) => { //  display the extended token a,d save it to a file  token.txt
    res.json(extendedToken);
    writeFile(extendedToken.access_token);
})

app.get('/api/products', async (req, res) => {

    // console.log(tokenfile);
    const url = 'https://api.partnercenter.microsoft.com/v1/products?country=GB&targetView=MicrosoftAzure';

    axios.get(url, {
        headers: {
            'Authorization': `Bearer ${tokenfile}`,

            'Accept': 'application/json',
            // 'MS-RequestId': '3705fc6d-4127-4a87-bdba-9658f73fe019',
            // 'MS-CorrelationId': 'b12260fb-82de-4701-a25f-dcd367690645'
        }
    })
        .then((response) => {
            console.log(response.data);
            res.json(response.data)
        })
        .catch((e) => {
            console.error(e);
            error = e;
            res.redirect('error')
        });

})

app.get('/api/customers', (req, res) => {
    const url = 'https://api.partnercenter.microsoft.com/v1/customers';

    axios.get(url, {
        headers: {
            'Authorization': `Bearer ${tokenfile}`,

            'Accept': 'application/json',
            // 'MS-RequestId': '3705fc6d-4127-4a87-bdba-9658f73fe019',
            // 'MS-CorrelationId': 'b12260fb-82de-4701-a25f-dcd367690645'
        }
    })
        .then((response) => {
            console.log(response.data);
            res.json(response.data)
        })
        .catch((e) => {
            console.error(e);
            error = e;
            res.redirect('error')
        });

})

app.get('/api/invoices', (req, res) => {
    const url='https://api.partnercenter.microsoft.com/v1/invoices';
    axios.get(url, {
        headers: {
            'Authorization': `Bearer ${tokenfile}`,
            'Accept': 'application/json',
        }
    })
        .then(response => {
            const data = response.data;
            res.json(data);
        })
        .catch(error => {
            console.log(error);
            res.status(500).send('Error retrieving invoices');
        });
});
app.get('/customers', (req, res) => {
    res.sendFile(__dirname + '/customers.html');
});
app.get('/customers/:id', (req, res) => {
    res.sendFile(__dirname + '/customer.html');
});

app.get('/api/customers/:id', (req, res) => {
    const customerId = req.params.id;
    axios.get(`https://api.partnercenter.microsoft.com/v1/customers/${customerId}`, {
        headers: {
            'Authorization': `Bearer ${tokenfile}`,
            'Accept': 'application/json',
        }
    })
        .then(response => {
            const customer = response.data;
            res.json(customer);
        })
        .catch(error => {
            console.log(error);
            res.status(500).send('Error retrieving customer details');
        });
});



function writeFile(data) {
    fs.writeFile('token.txt', data, (err) => {
        if (err) {
            console.error(err);
        } else {
            console.log('Token written to file successfully!');
        }
    });
}

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

