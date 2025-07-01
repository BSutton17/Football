export const catchBall = (openness, qbPenalty) =>{
    const catchRate = Math.random() * (100 - 1) + 1
    const adjustedCatchRate = catchRate / (qbPenalty / 100)
    console.log("Catch Rate: " + catchRate + " Adjusted Catch Rate: " + adjustedCatchRate)
    switch(openness){
        case "lime":
            if(adjustedCatchRate < 99){
                return "Caught"
            }
            else{
                return "Dropped"
            }
        case "yellow":
            if(adjustedCatchRate < 42){
                return "Caught"
            }
            else if(adjustedCatchRate >= 43 && adjustedCatchRate < 99){
                return "Broken Up"
            }
            else {
                return "Intercepted"
            }
        case "red":
            if(adjustedCatchRate < 20){
                return "Caught"
            }
            else if(adjustedCatchRate >= 21 && adjustedCatchRate < 85){
                return "Broken Up"
            }
            else {
                return "Intercepted"
            }
    }
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}