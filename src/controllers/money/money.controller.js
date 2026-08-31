// controllers/money/mone.controller.js
const userService = require('../../services/auth/auth.service');
const moneyService = require('../../services/money/money.service');
const responseBuilder = require('../../utils/response.builder')


async function deposite(req,res,next){

    try {
        const { amount } = req.body;

        const result = await moneyService.deposite(req.user.id, amount);

        return res.status(result.status).json(result)
    
    } catch (err) {
        next(err)
        
    }

}

async function withdraw(req,res,next){

    try {
        const { amount } = req.body;

        const result = await moneyService.withdraw(req.user.id, amount);

        return res.status(result.status).json(result)
    
    } catch (err) {
        next(err)
        
    }

}

module.exports = {
    deposite,
    withdraw
};