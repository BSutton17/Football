export const catchBall = (openness, qbPenalty) =>{
    const catchRate = Math.random() * (100 - 1) + 1
    const adjustedCatchRate = catchRate / (qbPenalty / 100)
    console.log("Catch Rate: " + catchRate + " Adjusted Catch Rate: " + adjustedCatchRate)
    switch(openness){
        case "lime":
            if(adjustedCatchRate < 96){
                return "Caught"
            }
            else{
                return "Dropped"
            }
        case "yellow":
            if(adjustedCatchRate < 50){
                return "Caught"
            }
            else if(adjustedCatchRate >= 51 && adjustedCatchRate < 95){
                return "Broken Up"
            }
            else {
                return "Intercepted"
            }
        case "red":
            if(adjustedCatchRate < 25){
                return "Caught"
            }
            else if(adjustedCatchRate >= 26 && adjustedCatchRate < 75){
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