import express from "express"
import got from "got";
const router= express.Router();
import got from "got";

const getAccessToken = async () => {
    try {
        const response = await got.post(`${process.env.PAYPAL_BASEURL}/v1/oauth2/token`, {
            form: { grant_type: "client_credentials" },
            username: process.env.PAYPAL_CLIENTID,
            password: process.env.PAYPAL_SECRET,
        });

        const data = JSON.parse(response.body);
        return data.access_token;
    } catch (err) {
        console.error("Error fetching PayPal token:", err);
        throw new Error("Failed to get PayPal access token");
    }
};
const createorder=async(req,res)=>{
    try{
        const accessToken = await getAccessToken();
        return res.status(200).json({message:"Order created successfully"});
    }catch(err){
        res.status(500).json({error:"Internal Server error"});
    }
};
router.post("/createorder",createOrder);
export default router