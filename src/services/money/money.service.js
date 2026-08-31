const userRepository = require('../../repositories/user/user.repository');
const transactionRepository = require('../../repositories/transaction/transaction.repository');
const CustomExceptions = require('../../middleware/CustomExceptions')
const responseBuilder = require('../../utils/response.builder')


const generateReference = (prefix = 'TXN') => {
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}-${randomDigits}`;
};


async function deposite(userId,amount){

    if (!amount || amount <= 0) {
        throw new CustomExceptions('Invalid amount',400)
        
    }

    const user = await userRepository.findById(userId)
    if (!user) {
        throw new CustomExceptions("User not found please refresh pages",404)
        
    }
    
    const currentBalance = parseFloat(user.balance);
    const depositAmount = parseFloat(amount);

    // Promo bonus: 1.5% of the FIRST deposit if user registered with a promo code
    let bonusAmount = 0;
    if (user.promo_code && !user.promo_bonus_applied) {
      bonusAmount = parseFloat((depositAmount * 0.015).toFixed(2));
      await user.update({ promo_bonus_applied: true });
    }

    const newBalance = currentBalance + depositAmount + bonusAmount;


    const updatedUser = await userRepository.deposite(userId,newBalance)
    if (!updatedUser) {
    throw new CustomExceptions('Failed to deposite balance', 500);
  }

  // Rekodi transaction ya DEPOSIT (completed success)
  try {
    await transactionRepository.createTransaction({
      reference: generateReference('DEP'),
      user_id: userId,
      type: 'DEPOSIT',
      amount: parseFloat((depositAmount + bonusAmount).toFixed(2)),
      balance_before: currentBalance,
      balance_after: newBalance,
      status: 'SUCCESS',
      description: bonusAmount > 0
        ? `Deposit TZS ${depositAmount} + bonus TZS ${bonusAmount}`
        : `Deposit TZS ${depositAmount}`
    });
  } catch (txnError) {
    console.error('⚠️ Failed to record deposit transaction:', txnError.message);
  }

  return responseBuilder.success({
    status: 200,
    message: "Successfully withdrew amount",
    data: {
      user: {
        id: updatedUser.id,        
        phone_number: updatedUser.phone_number, 
        role: updatedUser.role,      
        status: updatedUser.status,   
        balance: updatedUser.balance, 
        created_at: updatedUser.createdAt 
      },
      bonus: {
        applied: bonusAmount > 0,
        amount: bonusAmount
      }
    }
  });
}



async function withdraw (userId,amount){

    if (!amount || amount <= 0) {
        throw new CustomExceptions('Invalid amount',400)
        
    }

    const user = await userRepository.findById(userId)
    if (!user) {
        throw new CustomExceptions("User not found please refresh pages",404)
    }
    const currentBalance = parseFloat(user.balance);
    const withdrawAmount = parseFloat(amount);
    if (currentBalance < withdrawAmount) {
        throw new CustomExceptions('Insufficient balance', 400)
    }
    const newBalance = currentBalance - withdrawAmount;


    const updatedUser = await userRepository.withdraw(userId,newBalance)
    if (!updatedUser) {
    throw new CustomExceptions('Failed to withdraw balance', 500);
  }

  // Rekodi transaction ya WITHDRAWAL (completed success)
  try {
    await transactionRepository.createTransaction({
      reference: generateReference('WIT'),
      user_id: userId,
      type: 'WITHDRAWAL',
      amount: withdrawAmount,
      balance_before: currentBalance,
      balance_after: newBalance,
      status: 'SUCCESS',
      description: `Withdrawal TZS ${withdrawAmount}`
    });
  } catch (txnError) {
    console.error('⚠️ Failed to record withdrawal transaction:', txnError.message);
  }

  return responseBuilder.success({
    status: 200,
    message: "Successfully withdrew amount",
    data: {
      user: {
        id: updatedUser.id,        
        phone_number: updatedUser.phone_number, 
        role: updatedUser.role,      
        status: updatedUser.status,   
        balance: updatedUser.balance, 
        created_at: updatedUser.createdAt 
      }
    }
  });
}

module.exports = {
  deposite,
  withdraw
};